import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Customer, Vendor, Product, Expense, Invoice, Receipt, Company } from '../models/index.js';
import { crudRouter } from '../services/crud.js';
import { guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate, pageMeta, escapeRegex } from '../utils/pagination.js';
import { computeInvoice, financialYear } from '../policy/gst.js';
import { isValidGstin } from '../policy/gstin.js';
import { nextSeq } from '../services/counter.js';
import { audit } from '../services/audit.js';
import { toCsv } from '../utils/csv.js';

const r = Router();
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const gstinCheck = (_req, data) => {
  if (data.gstin && !isValidGstin(data.gstin)) throw ApiError.badRequest('Invalid GSTIN');
  if (data.gstin && !data.stateCode) data.stateCode = data.gstin.slice(0, 2);
  return data;
};

/* ------------------------------- Masters -------------------------------- */
r.get('/customers/:id/ledger', guard({ permission: 'billing.customer.view' }), h(async (req, res) => {
  const customer = await Customer.findOne({ company: req.tenantId, _id: req.params.id }).lean();
  if (!customer) throw ApiError.notFound('Customer not found');
  const [invoices, receipts] = await Promise.all([
    Invoice.find({ company: req.tenantId, customer: customer._id, type: { $in: ['invoice', 'credit_note', 'debit_note'] }, status: { $ne: 'cancelled' } }).select('type number date grandTotal').lean(),
    Receipt.find({ company: req.tenantId, customer: customer._id }).select('number date amount mode').lean(),
  ]);
  const entries = [
    ...invoices.map((i) => ({ date: i.date, ref: i.number, type: i.type, debit: i.type === 'credit_note' ? 0 : i.grandTotal, credit: i.type === 'credit_note' ? i.grandTotal : 0 })),
    ...receipts.map((p) => ({ date: p.date, ref: p.number, type: 'receipt', debit: 0, credit: p.amount, mode: p.mode })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));
  let bal = customer.openingBalance || 0;
  for (const e of entries) { bal += e.debit - e.credit; e.balance = Math.round(bal * 100) / 100; }
  res.json({ success: true, data: { customer, openingBalance: customer.openingBalance || 0, entries, closingBalance: bal } });
}));

r.use('/customers', crudRouter(Customer, {
  perm: 'billing.customer', search: ['name', 'email', 'phone', 'gstin'], beforeSave: gstinCheck, sort: { name: 1 },
  csv: [['Name', 'name'], ['GSTIN', 'gstin'], ['Email', 'email'], ['Phone', 'phone'], ['City', (c) => c.billingAddress?.city], ['State code', 'stateCode']],
}));
r.use('/vendors', crudRouter(Vendor, { perm: 'billing.vendor', search: ['name', 'email', 'gstin'], beforeSave: gstinCheck, sort: { name: 1 } }));
r.use('/products', crudRouter(Product, { perm: 'billing.product', search: ['name', 'sku', 'hsnSac'], sort: { name: 1 }, filters: ['type'] }));
r.use('/expenses', crudRouter(Expense, {
  perm: 'billing.expense', search: ['category', 'description', 'reference'], dateField: 'date', sort: { date: -1 }, filters: ['status', 'category'],
  populate: { path: 'vendor', select: 'name', match: {} },
  beforeSave: (req, data, existing) => { if (!existing) data.createdBy = req.user._id; return data; },
  csv: [['Date', 'date'], ['Category', 'category'], ['Vendor', (e) => e.vendor?.name], ['Description', 'description'], ['Amount', 'amount'], ['GST', 'gstAmount'], ['Mode', 'paymentMode'], ['Status', 'status']],
}));

/* ------------------------------- Invoices -------------------------------- */
const PREFIX = { invoice: 'invoicePrefix', proforma: 'proformaPrefix', credit_note: 'creditNotePrefix', debit_note: 'debitNotePrefix' };
const line = z.object({
  product: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('').transform(() => undefined)),
  description: z.string().trim().min(1).max(300), hsnSac: z.string().max(12).optional(), unit: z.string().max(12).optional(),
  quantity: z.coerce.number().positive(), rate: z.coerce.number().min(0), discountPercent: z.coerce.number().min(0).max(100).optional(),
  taxRate: z.coerce.number().min(0).max(28),
});
const invoiceSchema = z.object({
  type: z.enum(['invoice', 'proforma', 'credit_note', 'debit_note']).default('invoice'),
  customer: z.string().regex(/^[a-f\d]{24}$/i), date: z.coerce.date().optional(), dueDate: z.coerce.date().optional().nullable(),
  placeOfSupply: z.string().regex(/^\d{2}$/, 'Place of supply must be a 2-digit state code').optional(),
  taxInclusive: z.boolean().optional(), items: z.array(line).min(1, 'Add at least one item').max(200),
  discountTotal: z.coerce.number().min(0).optional(), notes: z.string().max(2000).optional(), terms: z.string().max(2000).optional(),
  referenceInvoice: z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal('').transform(() => undefined)),
  status: z.enum(['draft', 'issued']).optional(),
});
const countThisMonth = (req) => {
  const d = new Date();
  return Invoice.countDocuments({ company: req.tenantId, type: 'invoice', createdAt: { $gte: new Date(d.getFullYear(), d.getMonth(), 1) } });
};

async function buildInvoice(req, body) {
  const company = await Company.findById(req.tenantId).lean();
  const customer = await Customer.findOne({ company: req.tenantId, _id: body.customer }).lean();
  if (!customer) throw ApiError.badRequest('Customer not found');
  const supplierStateCode = company.address?.stateCode || company.gstin?.slice(0, 2);
  const placeOfSupply = body.placeOfSupply || customer.stateCode || customer.gstin?.slice(0, 2) || supplierStateCode;
  const calc = computeInvoice(body.items, { supplierStateCode, placeOfSupply, taxInclusive: body.taxInclusive, discountTotal: body.discountTotal });
  const addr = customer.billingAddress || {};
  return {
    company, data: {
      ...body, ...calc, supplierStateCode, placeOfSupply,
      customerSnapshot: { name: customer.name, gstin: customer.gstin, email: customer.email, phone: customer.phone, stateCode: placeOfSupply,
        address: [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') },
    },
  };
}

r.get('/invoices', guard({ permission: 'billing.invoice.view' }), h(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = { company: req.tenantId };
  for (const k of ['type', 'status']) if (req.query[k] && req.query[k] !== 'all') f[k] = req.query[k];
  if (req.query.customer && mongoose.isValidObjectId(req.query.customer)) f.customer = oid(req.query.customer);
  if (req.query.q) { const rx = new RegExp(escapeRegex(req.query.q), 'i'); f.$or = [{ number: rx }, { 'customerSnapshot.name': rx }]; }
  if (req.query.from || req.query.to) { f.date = {}; if (req.query.from) f.date.$gte = new Date(req.query.from); if (req.query.to) f.date.$lte = new Date(`${req.query.to}T23:59:59Z`); }
  const [items, total] = await Promise.all([
    Invoice.find(f).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).select('-items -taxSummary').lean(),
    Invoice.countDocuments(f),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}));

r.get('/invoices/export.csv', guard({ permission: 'billing.invoice.export', export: true }), h(async (req, res) => {
  const f = { company: req.tenantId };
  if (req.query.type && req.query.type !== 'all') f.type = req.query.type;
  const items = await Invoice.find(f).sort({ date: -1 }).limit(20000).lean();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
  res.send(toCsv(items, [['Type', 'type'], ['Number', 'number'], ['Date', 'date'], ['Customer', (i) => i.customerSnapshot?.name], ['GSTIN', (i) => i.customerSnapshot?.gstin],
    ['Place of supply', 'placeOfSupply'], ['Taxable', 'subtotal'], ['CGST', 'cgst'], ['SGST', 'sgst'], ['IGST', 'igst'], ['Total', 'grandTotal'], ['Paid', 'amountPaid'], ['Status', 'status']]));
}));

r.get('/invoices/:id', guard({ permission: 'billing.invoice.view' }), h(async (req, res) => {
  const inv = await Invoice.findOne({ company: req.tenantId, _id: req.params.id }).lean();
  if (!inv) throw ApiError.notFound('Invoice not found');
  const company = await Company.findById(req.tenantId).select('name gstin pan address phone email logoUrl billingSettings').lean();
  const receipts = await Receipt.find({ company: req.tenantId, invoice: inv._id }).sort({ date: 1 }).lean();
  res.json({ success: true, data: { invoice: inv, company, receipts } });
}));

r.post('/invoices', guard({ permission: 'billing.invoice.create', write: true, limit: { name: 'invoicesPerMonth', count: countThisMonth } }),
  validate({ body: invoiceSchema }), h(async (req, res) => {
    const { company, data } = await buildInvoice(req, req.body);
    const date = data.date || new Date();
    const fy = financialYear(date, company.settings?.financialYearStartMonth || 4);
    const prefix = company.billingSettings?.[PREFIX[data.type]] || 'INV';
    const seq = await nextSeq(req.tenantId, `${data.type}:${fy}`);
    const inv = await Invoice.create({
      ...data, company: req.tenantId, date, financialYear: fy, number: `${prefix}/${fy}/${String(seq).padStart(4, '0')}`,
      dueDate: data.dueDate || (data.type === 'invoice' ? new Date(date.getTime() + (company.billingSettings?.defaultDueDays ?? 15) * 864e5) : undefined),
      terms: data.terms ?? company.billingSettings?.defaultTerms, status: data.status || 'issued', createdBy: req.user._id,
    });
    audit(req, 'invoice.create', { targetType: 'Invoice', targetId: inv._id, summary: `${inv.number} · ₹${inv.grandTotal}` });
    res.status(201).json({ success: true, data: inv });
  }));

r.patch('/invoices/:id', guard({ permission: 'billing.invoice.edit', write: true }), validate({ body: invoiceSchema }), h(async (req, res) => {
  const inv = await Invoice.findOne({ company: req.tenantId, _id: req.params.id });
  if (!inv) throw ApiError.notFound('Invoice not found');
  if (inv.status === 'cancelled' || inv.amountPaid > 0) throw ApiError.conflict('Paid or cancelled invoices cannot be edited. Issue a credit/debit note instead.');
  const { data } = await buildInvoice(req, { ...req.body, type: inv.type });
  delete data.type;
  inv.set(data);
  await inv.save();
  audit(req, 'invoice.update', { targetType: 'Invoice', targetId: inv._id, summary: inv.number });
  res.json({ success: true, data: inv });
}));

r.post('/invoices/:id/cancel', guard({ permission: 'billing.invoice.delete', write: true }), h(async (req, res) => {
  const inv = await Invoice.findOne({ company: req.tenantId, _id: req.params.id });
  if (!inv) throw ApiError.notFound('Invoice not found');
  if (inv.amountPaid > 0) throw ApiError.conflict('This invoice has payments recorded. Issue a credit note instead.');
  inv.status = 'cancelled';
  await inv.save();
  audit(req, 'invoice.cancel', { targetType: 'Invoice', targetId: inv._id, summary: inv.number });
  res.json({ success: true, data: inv });
}));

const paymentSchema = z.object({
  amount: z.coerce.number().positive(), date: z.coerce.date().optional(), mode: z.enum(['cash', 'bank', 'upi', 'card', 'cheque', 'other']).default('bank'),
  reference: z.string().max(100).optional(), notes: z.string().max(500).optional(),
});
r.post('/invoices/:id/payments', guard({ permission: 'billing.invoice.edit', write: true }), validate({ body: paymentSchema }), h(async (req, res) => {
  const inv = await Invoice.findOne({ company: req.tenantId, _id: req.params.id });
  if (!inv) throw ApiError.notFound('Invoice not found');
  if (inv.type !== 'invoice' && inv.type !== 'debit_note') throw ApiError.badRequest('Payments can only be recorded against invoices and debit notes.');
  if (inv.status === 'cancelled') throw ApiError.badRequest('Invoice is cancelled.');
  const due = Math.round((inv.grandTotal - inv.amountPaid) * 100) / 100;
  if (req.body.amount > due + 0.001) throw ApiError.badRequest(`Amount exceeds the outstanding balance of ₹${due}.`);
  const company = await Company.findById(req.tenantId).select('billingSettings settings').lean();
  const fy = financialYear(req.body.date || new Date(), company.settings?.financialYearStartMonth || 4);
  const seq = await nextSeq(req.tenantId, `receipt:${fy}`);
  const receipt = await Receipt.create({ ...req.body, company: req.tenantId, customer: inv.customer, invoice: inv._id,
    number: `${company.billingSettings?.receiptPrefix || 'RCPT'}/${fy}/${String(seq).padStart(4, '0')}`, createdBy: req.user._id });
  inv.amountPaid = Math.round((inv.amountPaid + req.body.amount) * 100) / 100;
  inv.status = inv.amountPaid >= inv.grandTotal ? 'paid' : 'partially_paid';
  await inv.save();
  audit(req, 'invoice.payment', { targetType: 'Invoice', targetId: inv._id, summary: `${receipt.number} · ₹${receipt.amount} against ${inv.number}` });
  res.status(201).json({ success: true, data: { receipt, invoice: inv } });
}));

r.use('/receipts', crudRouter(Receipt, { perm: 'billing.invoice', search: ['number', 'reference'], create: false, remove: false, dateField: 'date', sort: { date: -1 },
  populate: [{ path: 'customer', select: 'name', match: {} }, { path: 'invoice', select: 'number', match: {} }], fields: ['notes', 'reference'] }));

/* -------------------------------- Reports -------------------------------- */
const range = (q) => {
  const to = q.to ? new Date(`${q.to}T23:59:59Z`) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getFullYear(), to.getMonth() - 11, 1);
  return { from, to };
};

r.get('/reports/summary', guard({ permission: 'billing.invoice.view' }), h(async (req, res) => {
  const { from, to } = range(req.query);
  const c = req.tenantId;
  const [monthly, gst, outstanding, expenses, topCustomers] = await Promise.all([
    Invoice.aggregate([{ $match: { company: c, type: 'invoice', status: { $ne: 'cancelled' }, deletedAt: null, date: { $gte: from, $lte: to } } },
      { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, revenue: { $sum: '$grandTotal' }, taxable: { $sum: '$subtotal' }, tax: { $sum: '$totalTax' }, count: { $sum: 1 } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
    Invoice.aggregate([{ $match: { company: c, type: { $in: ['invoice', 'debit_note', 'credit_note'] }, status: { $ne: 'cancelled' }, deletedAt: null, date: { $gte: from, $lte: to } } },
      { $unwind: '$taxSummary' }, { $group: { _id: { rate: '$taxSummary.taxRate', credit: { $eq: ['$type', 'credit_note'] } }, taxableValue: { $sum: '$taxSummary.taxableValue' }, cgst: { $sum: '$taxSummary.cgst' }, sgst: { $sum: '$taxSummary.sgst' }, igst: { $sum: '$taxSummary.igst' } } }, { $sort: { '_id.rate': 1 } }]),
    Invoice.aggregate([{ $match: { company: c, type: { $in: ['invoice', 'debit_note'] }, status: { $in: ['issued', 'partially_paid'] }, deletedAt: null } },
      { $project: { number: 1, date: 1, dueDate: 1, customer: '$customerSnapshot.name', due: { $subtract: ['$grandTotal', '$amountPaid'] } } }, { $sort: { dueDate: 1 } }, { $limit: 200 }]),
    Expense.aggregate([{ $match: { company: c, deletedAt: null, status: { $ne: 'rejected' }, date: { $gte: from, $lte: to } } }, { $group: { _id: '$category', amount: { $sum: '$amount' } } }, { $sort: { amount: -1 } }]),
    Invoice.aggregate([{ $match: { company: c, type: 'invoice', status: { $ne: 'cancelled' }, deletedAt: null, date: { $gte: from, $lte: to } } }, { $group: { _id: '$customerSnapshot.name', revenue: { $sum: '$grandTotal' } } }, { $sort: { revenue: -1 } }, { $limit: 5 }]),
  ]);
  const totalOutstanding = outstanding.reduce((s, o) => s + o.due, 0);
  const now = Date.now();
  res.json({ success: true, data: {
    from, to,
    monthly: monthly.map((m) => ({ month: new Date(m._id.y, m._id.m - 1, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' }), revenue: Math.round(m.revenue), taxable: Math.round(m.taxable), tax: Math.round(m.tax), count: m.count })),
    totals: { revenue: monthly.reduce((s, m) => s + m.revenue, 0), invoices: monthly.reduce((s, m) => s + m.count, 0), outstanding: totalOutstanding,
      overdue: outstanding.filter((o) => o.dueDate && new Date(o.dueDate).getTime() < now).reduce((s, o) => s + o.due, 0), expenses: expenses.reduce((s, e) => s + e.amount, 0) },
    gst: gst.map((g) => ({ taxRate: g._id.rate, creditNote: g._id.credit, taxableValue: g.taxableValue, cgst: g.cgst, sgst: g.sgst, igst: g.igst })),
    outstanding, expenses: expenses.map((e) => ({ category: e._id, amount: e.amount })), topCustomers: topCustomers.map((t) => ({ name: t._id, revenue: t.revenue })),
  } });
}));

/* -------------------------------- Settings -------------------------------- */
r.get('/settings', guard({ permission: 'billing.settings.view' }), h(async (req, res) => {
  const c = await Company.findById(req.tenantId).select('billingSettings').lean();
  res.json({ success: true, data: c.billingSettings || {} });
}));
const billingSettingsSchema = z.object({
  invoicePrefix: z.string().max(10), proformaPrefix: z.string().max(10), creditNotePrefix: z.string().max(10), debitNotePrefix: z.string().max(10), receiptPrefix: z.string().max(10),
  defaultTerms: z.string().max(2000), bankDetails: z.string().max(500), upiId: z.string().max(100), signatory: z.string().max(100), defaultDueDays: z.coerce.number().int().min(0).max(365),
}).partial();
r.patch('/settings', guard({ permission: 'billing.settings.configure', write: true }), validate({ body: billingSettingsSchema }), h(async (req, res) => {
  const $set = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [`billingSettings.${k}`, v]));
  const c = await Company.findByIdAndUpdate(req.tenantId, { $set }, { new: true }).select('billingSettings').lean();
  audit(req, 'billing.settings_updated', { meta: req.body });
  res.json({ success: true, data: c.billingSettings });
}));

export default r;
