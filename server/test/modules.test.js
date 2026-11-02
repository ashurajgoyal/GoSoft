import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { computeInvoice, financialYear, amountInWords } from '../src/policy/gst.js';
import { computePayslip } from '../src/policy/payroll.js';
import { computeDay, countLeaveDays } from '../src/policy/attendance.js';
import { toCsv } from '../src/utils/csv.js';

import { verifyWebhookSignature } from '../src/utils/webhookSignature.js';

test('GST: intra-state splits CGST/SGST, inter-state uses IGST', () => {
  const items = [{ description: 'AMC', quantity: 1, rate: 10000, taxRate: 18 }];
  const intra = computeInvoice(items, { supplierStateCode: '08', placeOfSupply: '08' });
  assert.equal(intra.cgst, 900); assert.equal(intra.sgst, 900); assert.equal(intra.igst, 0); assert.equal(intra.grandTotal, 11800);
  const inter = computeInvoice(items, { supplierStateCode: '08', placeOfSupply: '27' });
  assert.equal(inter.igst, 1800); assert.equal(inter.cgst, 0); assert.equal(inter.interState, true);
});

test('GST: tax-inclusive pricing, discounts, rounding and rate summary', () => {
  const r = computeInvoice([
    { description: 'A', quantity: 1, rate: 1180, taxRate: 18 },
    { description: 'B', quantity: 3, rate: 105, taxRate: 5, discountPercent: 10 },
  ], { supplierStateCode: '08', placeOfSupply: '08', taxInclusive: true });
  assert.equal(r.items[0].taxableValue, 1000);
  assert.equal(r.items[0].cgst, 90);
  assert.equal(r.taxSummary.length, 2);
  assert.equal(r.grandTotal, Math.round(r.subtotal + r.totalTax));
  assert.ok(Math.abs(r.roundOff) < 1);
});

test('financial year and amount in words', () => {
  assert.equal(financialYear(new Date('2026-04-01')), '2026-27');
  assert.equal(financialYear(new Date('2027-03-31')), '2026-27');
  assert.equal(amountInWords(11800), 'Eleven Thousand Eight Hundred Rupees Only');
  assert.equal(amountInWords(1250000), 'Twelve Lakh Fifty Thousand Rupees Only');
});

test('Payroll: PF on capped basic, ESI eligibility, PT slab, TDS, LOP proration', () => {
  const p = computePayslip({ basic: 20000, hra: 8000, allowances: [{ name: 'Special', amount: 2000 }], tdsMonthly: 1000 }, { totalDays: 30, paidDays: 30 });
  assert.equal(p.gross, 30000);
  assert.equal(p.deductions.find((d) => d.name === 'Provident Fund').amount, 1800); // 12% of 15,000 ceiling
  assert.equal(p.deductions.find((d) => d.name === 'ESI'), undefined);             // above ₹21,000
  assert.equal(p.deductions.find((d) => d.name === 'Professional Tax').amount, 200);
  assert.equal(p.netPay, 30000 - 1800 - 200 - 1000);

  const low = computePayslip({ basic: 10000, hra: 4000 }, { totalDays: 30, paidDays: 15 });
  assert.equal(low.gross, 7000);
  assert.equal(low.lopDays, 15);
  assert.equal(low.deductions.find((d) => d.name === 'ESI').amount, Math.ceil(7000 * 0.0075));
  assert.equal(low.deductions.find((d) => d.name === 'Professional Tax'), undefined);
});

test('Payroll: settings switch statutory components off', () => {
  const p = computePayslip({ basic: 10000 }, { totalDays: 30 }, { pfEnabled: false, esiEnabled: false, ptEnabled: false });
  assert.equal(p.totalDeductions, 0);
});

test('Attendance: late, breaks, overtime, half day', () => {
  const day = (h, m) => new Date(Date.UTC(2026, 10, 2, h - 5, m - 30)); // IST → UTC
  const full = computeDay({ checkIn: day(10, 0), checkOut: day(19, 30), breaks: [{ start: day(13, 0), end: day(13, 30) }] }, { shiftStart: '09:30', graceMinutes: 15 });
  assert.equal(full.lateMinutes, 15);
  assert.equal(full.breakMinutes, 30);
  assert.equal(full.workMinutes, 9 * 60);
  assert.equal(full.overtimeMinutes, 60);
  assert.equal(full.status, 'present');
  assert.equal(computeDay({ checkIn: day(9, 30), checkOut: day(14, 30) }, {}).status, 'half_day');
});

test('Leave days skip weekly offs and holidays', () => {
  // Mon 2 Nov 2026 → Sun 8 Nov 2026, Sunday off, Wed 4 Nov holiday
  assert.equal(countLeaveDays(new Date('2026-11-02'), new Date('2026-11-08'), [0], ['2026-11-04']), 5);
});

test('Cashfree webhook signature verification', () => {
  const secret = 'test_secret'; const ts = '1730000000000'; const body = Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK"}');
  const sig = crypto.createHmac('sha256', secret).update(ts + body.toString()).digest('base64');
  assert.equal(verifyWebhookSignature(body, ts, sig, secret), true);
  assert.equal(verifyWebhookSignature(body, ts, sig, 'wrong'), false);
  assert.equal(verifyWebhookSignature(Buffer.from('{"tampered":1}'), ts, sig, secret), false);
});

test('CSV export escapes formulas and quotes', () => {
  const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'x,y' }], [['A', 'a'], ['B', 'b']]);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes('"x,y"'));
});
