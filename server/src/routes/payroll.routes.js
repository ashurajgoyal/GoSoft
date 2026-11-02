import { Router } from 'express';
import { z } from 'zod';
import { PayrollRun, Payslip, Employee, Attendance, LeaveRequest, LeaveType, Company } from '../models/index.js';
import { guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { computePayslip, DEFAULT_PAYROLL_SETTINGS } from '../policy/payroll.js';
import { decrypt } from '../utils/crypto.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { toCsv } from '../utils/csv.js';

const r = Router();
const pad = (n) => String(n).padStart(2, '0');
const settingsOf = (c) => ({ ...DEFAULT_PAYROLL_SETTINGS, ...(c.payrollSettings || {}) });

r.get('/settings', guard({ permission: 'payroll.payroll.view', minScope: 'company' }), h(async (req, res) => {
  res.json({ success: true, data: settingsOf(await Company.findById(req.tenantId).select('payrollSettings').lean()) });
}));
const settingsSchema = z.object({
  pfEnabled: z.boolean(), pfEmployeeRate: z.number().min(0).max(30), pfEmployerRate: z.number().min(0).max(30), pfWageCeiling: z.number().min(0), pfApplyCeiling: z.boolean(),
  esiEnabled: z.boolean(), esiEmployeeRate: z.number().min(0).max(10), esiEmployerRate: z.number().min(0).max(10), esiWageLimit: z.number().min(0),
  ptEnabled: z.boolean(), ptSlabs: z.array(z.object({ upTo: z.number().nullable(), amount: z.number().min(0) })).max(20),
  tdsEnabled: z.boolean(), overtimeMultiplier: z.number().min(0).max(5), workingDaysMode: z.enum(['calendar', 'fixed']), fixedWorkingDays: z.number().int().min(1).max(31),
}).partial();
r.patch('/settings', guard({ permission: 'payroll.payroll.approve', write: true, minScope: 'company' }), validate({ body: settingsSchema }), h(async (req, res) => {
  const c = await Company.findById(req.tenantId);
  c.payrollSettings = { ...settingsOf(c), ...req.body };
  c.markModified('payrollSettings');
  await c.save();
  audit(req, 'payroll.settings_updated', { meta: req.body });
  res.json({ success: true, data: c.payrollSettings });
}));

/* ------------------------------ Self-service ------------------------------ */
r.get('/payslips/me', guard({ permission: 'payroll.payslip.view' }), h(async (req, res) => {
  if (!req.employee) return res.json({ success: true, data: [] });
  const items = await Payslip.find({ company: req.tenantId, employee: req.employee._id, status: { $in: ['approved', 'paid'] } }).sort({ year: -1, month: -1 }).lean();
  res.json({ success: true, data: items });
}));

r.get('/payslips/:id', guard({ permission: 'payroll.payslip.view' }), h(async (req, res) => {
  const f = { company: req.tenantId, _id: req.params.id };
  if (req.scope !== 'company') Object.assign(f, { employee: req.employee?._id || null, status: { $in: ['approved', 'paid'] } });
  const slip = await Payslip.findOne(f).lean();
  if (!slip) throw ApiError.notFound('Payslip not found');
  const company = await Company.findById(req.tenantId).select('name address gstin logoUrl').lean();
  res.json({ success: true, data: { payslip: slip, company } });
}));

/* --------------------------------- Runs ----------------------------------- */
const hr = { permission: 'payroll.payroll.view', minScope: 'company' };
r.get('/runs', guard(hr), h(async (req, res) => {
  res.json({ success: true, data: await PayrollRun.find({ company: req.tenantId }).sort({ year: -1, month: -1 }).limit(60).lean() });
}));

async function inputsFor(req, emp, month, year, settings) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalDays = settings.workingDaysMode === 'fixed' ? settings.fixedWorkingDays : daysInMonth;
  const unpaidTypes = await LeaveType.find({ company: req.tenantId, paid: false }).distinct('_id');
  const [unpaid, att] = await Promise.all([
    LeaveRequest.aggregate([{ $match: { company: req.tenantId, employee: emp._id, status: 'approved', leaveType: { $in: unpaidTypes }, deletedAt: null, from: { $lte: end }, to: { $gte: start } } }, { $group: { _id: null, d: { $sum: '$days' } } }]),
    Attendance.aggregate([{ $match: { company: req.tenantId, employee: emp._id, deletedAt: null, date: { $gte: `${year}-${pad(month)}-01`, $lte: `${year}-${pad(month)}-${pad(daysInMonth)}` } } }, { $group: { _id: null, ot: { $sum: '$overtimeMinutes' } } }]),
  ]);
  // Partial month for joiners / leavers.
  let eligible = totalDays;
  const join = emp.joiningDate ? new Date(emp.joiningDate) : null;
  if (join && join > start) eligible = Math.max(0, Math.round(totalDays * (daysInMonth - join.getUTCDate() + 1) / daysInMonth));
  const lop = unpaid[0]?.d || 0;
  return { totalDays, paidDays: Math.max(0, eligible - lop), overtimeHours: Math.round(((att[0]?.ot || 0) / 60) * 100) / 100, bonus: 0, incentive: 0, advanceRecovery: 0, otherDeductions: 0 };
}

r.post('/runs', guard({ permission: 'payroll.payroll.create', write: true, minScope: 'company' }),
  validate({ body: z.object({ month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2000).max(2100) }) }), h(async (req, res) => {
    const { month, year } = req.body;
    if (await PayrollRun.exists({ company: req.tenantId, month, year })) throw ApiError.conflict('A payroll run already exists for this month.');
    const company = await Company.findById(req.tenantId).select('payrollSettings').lean();
    const settings = settingsOf(company);
    const periodEnd = new Date(Date.UTC(year, month, 0));
    const employees = await Employee.find({ company: req.tenantId, status: { $ne: 'exited' }, joiningDate: { $lte: periodEnd } }).populate({ path: 'department', select: 'name', match: { company: req.tenantId } }).lean();
    if (!employees.length) throw ApiError.badRequest('No active employees with a salary structure for this period.');
    const run = await PayrollRun.create({ company: req.tenantId, month, year, createdBy: req.user._id });
    const slips = [];
    for (const emp of employees) {
      const inputs = await inputsFor(req, emp, month, year, settings);
      const calc = computePayslip(emp.salary, inputs, settings);
      const acct = decrypt(emp.bank?.accountNumberEnc);
      slips.push({ company: req.tenantId, run: run._id, employee: emp._id, month, year, inputs, ...calc,
        employeeSnapshot: { name: [emp.firstName, emp.lastName].filter(Boolean).join(' '), employeeId: emp.employeeId, designation: emp.designation, department: emp.department?.name, uan: emp.uan, bankAccount: acct ? `XXXX${String(acct).slice(-4)}` : '' } });
    }
    await Payslip.insertMany(slips);
    await refreshTotals(req, run);
    audit(req, 'payroll.run_created', { targetType: 'PayrollRun', targetId: run._id, summary: `${month}/${year} · ${slips.length} employees` });
    res.status(201).json({ success: true, data: run });
  }));

async function refreshTotals(req, run) {
  const slips = await Payslip.find({ company: req.tenantId, run: run._id }).lean();
  run.totals = {
    employees: slips.length,
    gross: Math.round(slips.reduce((s, p) => s + p.gross, 0)), deductions: Math.round(slips.reduce((s, p) => s + p.totalDeductions, 0)),
    net: Math.round(slips.reduce((s, p) => s + p.netPay, 0)), employerCost: Math.round(slips.reduce((s, p) => s + p.ctcMonthly, 0)),
  };
  await run.save();
}

r.get('/runs/:id', guard(hr), h(async (req, res) => {
  const run = await PayrollRun.findOne({ company: req.tenantId, _id: req.params.id }).lean();
  if (!run) throw ApiError.notFound('Payroll run not found');
  const payslips = await Payslip.find({ company: req.tenantId, run: run._id }).sort({ 'employeeSnapshot.employeeId': 1 }).lean();
  res.json({ success: true, data: { run, payslips } });
}));

r.patch('/payslips/:id', guard({ permission: 'payroll.payroll.edit', write: true, minScope: 'company' }), validate({ body: z.object({
  paidDays: z.coerce.number().min(0).max(31), overtimeHours: z.coerce.number().min(0).max(400), bonus: z.coerce.number().min(0), incentive: z.coerce.number().min(0),
  advanceRecovery: z.coerce.number().min(0), otherDeductions: z.coerce.number().min(0),
}).partial() }), h(async (req, res) => {
  const slip = await Payslip.findOne({ company: req.tenantId, _id: req.params.id });
  if (!slip) throw ApiError.notFound('Payslip not found');
  if (slip.status !== 'draft') throw ApiError.conflict('Approved payslips cannot be edited.');
  const [emp, company] = await Promise.all([Employee.findOne({ company: req.tenantId, _id: slip.employee }).lean(), Company.findById(req.tenantId).select('payrollSettings').lean()]);
  const inputs = { ...slip.inputs.toObject?.() ?? slip.inputs, ...req.body };
  slip.set({ inputs, ...computePayslip(emp?.salary || {}, inputs, settingsOf(company)) });
  await slip.save();
  const run = await PayrollRun.findOne({ company: req.tenantId, _id: slip.run });
  await refreshTotals(req, run);
  res.json({ success: true, data: slip });
}));

const transition = (from, to, perm) => h(async (req, res) => {
  const run = await PayrollRun.findOne({ company: req.tenantId, _id: req.params.id });
  if (!run) throw ApiError.notFound('Payroll run not found');
  if (run.status !== from) throw ApiError.conflict(`Run must be ${from} to mark it ${to}.`);
  run.status = to;
  if (to === 'approved') Object.assign(run, { approvedBy: req.user._id, approvedAt: new Date() });
  if (to === 'paid') run.paidAt = new Date();
  await run.save();
  await Payslip.updateMany({ company: req.tenantId, run: run._id }, { status: to });
  if (to === 'approved') {
    const empIds = await Payslip.find({ company: req.tenantId, run: run._id }).distinct('employee');
    const users = await Employee.find({ company: req.tenantId, _id: { $in: empIds }, user: { $ne: null } }).distinct('user');
    notify(req.tenantId, users, { title: 'Your payslip is ready', body: `Payslip for ${run.month}/${run.year} is now available.`, link: '/app/me', email: true });
  }
  audit(req, `payroll.run_${to}`, { targetType: 'PayrollRun', targetId: run._id, summary: `${run.month}/${run.year}` });
  res.json({ success: true, data: run });
});
r.post('/runs/:id/approve', guard({ permission: 'payroll.payroll.approve', write: true, minScope: 'company' }), transition('draft', 'approved'));
r.post('/runs/:id/mark-paid', guard({ permission: 'payroll.payroll.approve', write: true, minScope: 'company' }), transition('approved', 'paid'));

r.delete('/runs/:id', guard({ permission: 'payroll.payroll.edit', write: true, minScope: 'company' }), h(async (req, res) => {
  const run = await PayrollRun.findOne({ company: req.tenantId, _id: req.params.id });
  if (!run) throw ApiError.notFound('Payroll run not found');
  if (run.status !== 'draft') throw ApiError.conflict('Only draft runs can be deleted.');
  await Payslip.deleteMany({ company: req.tenantId, run: run._id });
  await PayrollRun.deleteOne({ company: req.tenantId, _id: run._id });
  audit(req, 'payroll.run_deleted', { targetType: 'PayrollRun', targetId: run._id });
  res.json({ success: true });
}));

r.get('/runs/:id/export.csv', guard({ permission: 'payroll.payroll.export', export: true, minScope: 'company' }), h(async (req, res) => {
  const slips = await Payslip.find({ company: req.tenantId, run: req.params.id }).lean();
  const emps = await Employee.find({ company: req.tenantId, _id: { $in: slips.map((s) => s.employee) } }).select('bank').lean();
  const bank = new Map(emps.map((e) => [String(e._id), e.bank || {}]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payroll.csv"');
  res.send(toCsv(slips, [['Employee ID', (s) => s.employeeSnapshot?.employeeId], ['Name', (s) => s.employeeSnapshot?.name], ['Paid days', 'paidDays'], ['Gross', 'gross'],
    ['Deductions', 'totalDeductions'], ['Net pay', 'netPay'], ['PF (employer)', (s) => s.employer?.pf], ['ESI (employer)', (s) => s.employer?.esi],
    ['Account name', (s) => bank.get(String(s.employee))?.accountName], ['Account number', (s) => decrypt(bank.get(String(s.employee))?.accountNumberEnc)], ['IFSC', (s) => bank.get(String(s.employee))?.ifsc]]));
}));

export default r;
