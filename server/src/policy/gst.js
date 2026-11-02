/**
 * GST calculation for Indian invoices. Pure function — unit tested.
 * Intra-state supply (supplier state == place of supply) → CGST + SGST (half each).
 * Inter-state supply → IGST. Rates come from each line, so rule changes are data, not code.
 */
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeInvoice(items = [], { supplierStateCode, placeOfSupply, taxInclusive = false, discountTotal = 0 } = {}) {
  const interState = !!(supplierStateCode && placeOfSupply && String(supplierStateCode) !== String(placeOfSupply));
  const lines = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const taxRate = Number(it.taxRate) || 0;
    const gross = qty * rate;
    const discount = Math.min(gross, (Number(it.discountPercent) || 0) / 100 * gross);
    const afterDiscount = gross - discount;
    const taxable = taxInclusive ? afterDiscount / (1 + taxRate / 100) : afterDiscount;
    const tax = taxable * taxRate / 100;
    return {
      ...it, quantity: qty, rate, taxRate, discount: r2(discount), taxableValue: r2(taxable),
      cgst: interState ? 0 : r2(tax / 2), sgst: interState ? 0 : r2(tax / 2), igst: interState ? r2(tax) : 0,
      total: r2(taxable + tax),
    };
  });
  const sum = (k) => r2(lines.reduce((s, l) => s + l[k], 0));
  const subtotal = sum('taxableValue');
  const cgst = sum('cgst'); const sgst = sum('sgst'); const igst = sum('igst');
  const beforeRound = subtotal + cgst + sgst + igst - (Number(discountTotal) || 0);
  const grandTotal = Math.round(beforeRound);

  const byRate = {};
  for (const l of lines) {
    const k = l.taxRate;
    byRate[k] ||= { taxRate: k, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
    for (const f of ['taxableValue', 'cgst', 'sgst', 'igst']) byRate[k][f] = r2(byRate[k][f] + l[f]);
  }
  return {
    items: lines, interState, subtotal, cgst, sgst, igst, totalTax: r2(cgst + sgst + igst),
    discountTotal: r2(Number(discountTotal) || 0), roundOff: r2(grandTotal - beforeRound), grandTotal,
    taxSummary: Object.values(byRate),
  };
}

/** Financial year label, e.g. 2026-27 for dates from April 2026 (start month configurable). */
export function financialYear(date = new Date(), startMonth = 4) {
  const d = new Date(date);
  const y = d.getMonth() + 1 >= startMonth ? d.getFullYear() : d.getFullYear() - 1;
  return startMonth === 1 ? String(y) : `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

/** Rupees in words (Indian numbering) for invoices. */
export function amountInWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ' ' + a[x % 10] : ''}`);
  const three = (x) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' + two(x % 100) : ''}` : two(x));
  let num = Math.round(Number(n) || 0);
  if (num === 0) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(num / 1e7); num %= 1e7;
  const lakh = Math.floor(num / 1e5); num %= 1e5;
  const thousand = Math.floor(num / 1e3); num %= 1e3;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (num) parts.push(three(num));
  return `${parts.join(' ')} Rupees Only`;
}
