import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Department, Employee, Attendance, LeaveType, LeaveRequest, Holiday, EmployeeRequest, Announcement, Company, User, Role } from '../models/index.js';
import { crudRouter } from '../services/crud.js';
import { guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { nextSeq } from '../services/counter.js';
import { notify } from '../services/notify.js';
import { audit } from '../services/audit.js';
import { resolvePermission } from '../policy/engine.js';
import { computeDay, ymd, countLeaveDays } from '../policy/attendance.js';
import { createUser, countSeats } from '../controllers/company.controller.js';

const r = Router();
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Team = direct reports of the caller's employee record (+ self). */
r.use(h(async (req, _res, next) => {
  req.teamEmployeeIds = req.employee
    ? [req.employee._id, ...(await Employee.find({ company: req.tenantId, reportingManager: req.employee._id }).distinct('_id'))]
    : [];
  next();
}));
const byEmployee = (req) => (req.scope === 'own' ? { employee: req.employee?._id || null } : { employee: { $in: req.teamEmployeeIds } });
const requireEmployee = (req) => { if (!req.employee) throw ApiError.forbidden('Your login is not linked to an employee profile. Ask HR to link it.', 'NO_EMPLOYEE_PROFILE'); return req.employee; };
const managersOf = async (req, employeeId) => {
  const emp = await Employee.findOne({ company: req.tenantId, _id: employeeId }).populate({ path: 'reportingManager', select: 'user', match: { company: req.tenantId } }).lean();
  return emp?.reportingManager?.user ? [emp.reportingManager.user] : [];
};

/* ------------------------------ Departments ------------------------------- */
r.use('/departments', crudRouter(Department, { perm: 'core.department', search: ['name'], sort: { name: 1 }, populate: { path: 'head', select: 'firstName lastName' } }));

/* -------------------------------- Employees -------------------------------- */
const mask = (v) => (v ? `XXXX${String(decrypt(v)).slice(-4)}` : '');
const empOut = (canSeeSensitive) => (e) => {
  const o = { ...e, name: [e.firstName, e.lastName].filter(Boolean).join(' ') };
  if (o.bank) o.bank = { ...o.bank, accountNumber: canSeeSensitive ? decrypt(o.bank.accountNumberEnc) : mask(o.bank.accountNumberEnc), accountNumberEnc: undefined };
  o.pan = canSeeSensitive ? decrypt(e.panEnc) : mask(e.panEnc);
  delete o.panEnc;
  if (!canSeeSensitive) delete o.salary;
  return o;
};
const countEmployees = (req) => Employee.countDocuments({ company: req.tenantId, status: { $ne: 'exited' } });

r.use('/employees', (req, res, next) => {
  // Salary & bank details are visible only to HR / payroll roles with company-wide scope.
  const s = resolvePermission(req.ctx.role, 'payroll.payroll.view');
  req.canSeeSensitive = s === 'company';
  next();
});

r.use('/employees', crudRouter(Employee, {
  perm: 'hrms.employee', search: ['firstName', 'lastName', 'employeeId', 'email', 'designation'], sort: { employeeId: 1 }, filters: ['status', 'department', 'employmentType'],
  limit: { name: 'employees', count: countEmployees },
  ownFilter: (req) => (req.scope === 'own' ? { _id: req.employee?._id || null } : { _id: { $in: req.teamEmployeeIds } }),
  populate: [{ path: 'department', select: 'name' }, { path: 'reportingManager', select: 'firstName lastName' }, { path: 'user', select: 'email status' }],
  transformOut: (doc, req) => empOut(req.canSeeSensitive)(doc),
  beforeSave: async (req, data, existing) => {
    delete data.panEnc; // encrypted fields are only ever written by the server
    if (data.bank) delete data.bank.accountNumberEnc;
    if (data.bank && data.bank.accountNumber === undefined && existing?.bank?.accountNumberEnc) data.bank.accountNumberEnc = existing.bank.accountNumberEnc;
    if (data.bank?.accountNumber !== undefined) {
      data.bank = { ...data.bank, accountNumberEnc: /^XXXX/.test(data.bank.accountNumber) ? existing?.bank?.accountNumberEnc : encrypt(data.bank.accountNumber) };
      delete data.bank.accountNumber;
    }
    if (data.pan !== undefined) { if (!/^XXXX/.test(data.pan)) data.panEnc = encrypt(String(data.pan).toUpperCase()); delete data.pan; }
    if (data.salary && !req.canSeeSensitive) delete data.salary;
    if (!existing && !data.employeeId) {
      const c = await Company.findById(req.tenantId).select('hrSettings').lean();
      data.employeeId = `${c.hrSettings?.employeeIdPrefix || 'EMP'}${String(await nextSeq(req.tenantId, 'employee')).padStart(4, '0')}`;
    }
    if (data.user && !(await User.exists({ _id: data.user, company: req.tenantId }))) throw ApiError.badRequest('Linked user not found in this company');
    for (const ref of ['department', 'reportingManager']) {
      if (data[ref] && !mongoose.isValidObjectId(data[ref])) delete data[ref];
    }
    return data;
  },
  csv: [['Employee ID', 'employeeId'], ['First name', 'firstName'], ['Last name', 'lastName'], ['Email', 'email'], ['Phone', 'phone'], ['Department', (e) => e.department?.name],
    ['Designation', 'designation'], ['Joining date', 'joiningDate'], ['Type', 'employmentType'], ['Status', 'status']],
}));

/* --------------------------------- Holidays -------------------------------- */
r.get('/holidays/calendar', guard({ module: 'hrms' }), h(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const items = await Holiday.find({ company: req.tenantId, date: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) } }).sort({ date: 1 }).lean();
  res.json({ success: true, data: items });
}));
r.use('/holidays', crudRouter(Holiday, { perm: 'hrms.settings', search: ['name'], sort: { date: 1 }, dateField: 'date' }));
// Holidays are readable by anyone in the company (calendar), edits need HR settings permission.
r.use('/leave-types', crudRouter(LeaveType, { perm: 'hrms.settings', search: ['name', 'code'], sort: { name: 1 } }));

/* -------------------------------- Attendance ------------------------------- */
async function today(req) {
  const emp = requireEmployee(req);
  const company = await Company.findById(req.tenantId).select('hrSettings settings').lean();
  const date = ymd(new Date(), company.settings?.timezone);
  return { emp, company, date };
}
const recompute = (att, company) => Object.assign(att, computeDay(att, company.hrSettings || {}, company.settings?.timezone));

r.get('/attendance/me/today', guard({ permission: 'hrms.attendance.view' }), h(async (req, res) => {
  const { emp, date } = await today(req);
  res.json({ success: true, data: await Attendance.findOne({ company: req.tenantId, employee: emp._id, date }).lean() });
}));

const punch = (action) => h(async (req, res) => {
  const { emp, company, date } = await today(req);
  let att = await Attendance.findOne({ company: req.tenantId, employee: emp._id, date });
  const now = new Date();
  if (action === 'check-in') {
    if (att?.checkIn) throw ApiError.conflict('You have already checked in today.');
    att = att || new Attendance({ company: req.tenantId, employee: emp._id, date });
    att.checkIn = now;
  } else {
    if (!att?.checkIn) throw ApiError.badRequest('Please check in first.');
    if (att.checkOut) throw ApiError.conflict('You have already checked out today.');
    const open = att.breaks.find((b) => !b.end);
    if (action === 'break-start') { if (open) throw ApiError.conflict('A break is already running.'); att.breaks.push({ start: now }); }
    if (action === 'break-end') { if (!open) throw ApiError.badRequest('No break is running.'); open.end = now; }
    if (action === 'check-out') { if (open) open.end = now; att.checkOut = now; }
  }
  recompute(att, company);
  await att.save();
  res.json({ success: true, data: att });
});
for (const a of ['check-in', 'break-start', 'break-end', 'check-out']) r.post(`/attendance/me/${a}`, guard({ permission: 'hrms.attendance.create', write: true }), punch(a));

r.get('/attendance', guard({ permission: 'hrms.attendance.view' }), h(async (req, res) => {
  const f = { company: req.tenantId };
  if (req.scope !== 'company' && req.scope !== 'department') Object.assign(f, byEmployee(req));
  if (req.query.employee && mongoose.isValidObjectId(req.query.employee)) f.employee = req.scope === 'company' || req.teamEmployeeIds.some((i) => String(i) === req.query.employee) ? oid(req.query.employee) : null;
  const from = req.query.from || ymd(new Date(Date.now() - 30 * 864e5));
  const to = req.query.to || ymd(new Date());
  f.date = { $gte: from, $lte: to };
  if (req.query.correction === 'pending') f['correction.status'] = 'pending';
  if (req.query.mine === '1') f.employee = req.employee?._id || null;
  const items = await Attendance.find(f).sort({ date: -1 }).limit(2000).populate({ path: 'employee', select: 'firstName lastName employeeId', match: { company: req.tenantId } }).lean();
  res.json({ success: true, data: items });
}));

const correctionSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkIn: z.coerce.date(), checkOut: z.coerce.date(), reason: z.string().trim().min(3).max(500) });
r.post('/attendance/me/correction', guard({ permission: 'hrms.attendance.create', write: true }), validate({ body: correctionSchema }), h(async (req, res) => {
  const emp = requireEmployee(req);
  if (req.body.checkOut <= req.body.checkIn) throw ApiError.badRequest('Check-out must be after check-in.');
  let att = await Attendance.findOne({ company: req.tenantId, employee: emp._id, date: req.body.date });
  att = att || new Attendance({ company: req.tenantId, employee: emp._id, date: req.body.date, status: 'absent' });
  att.correction = { requested: true, checkIn: req.body.checkIn, checkOut: req.body.checkOut, reason: req.body.reason, status: 'pending' };
  await att.save();
  notify(req.tenantId, await managersOf(req, emp._id), { title: 'Attendance correction requested', body: `${emp.firstName} requested a correction for ${req.body.date}.`, link: '/app/hr/attendance' });
  res.status(201).json({ success: true, data: att });
}));

r.post('/attendance/:id/correction', guard({ permission: 'hrms.attendance.approve', write: true }), validate({ body: z.object({ approve: z.boolean() }) }), h(async (req, res) => {
  const f = { company: req.tenantId, _id: req.params.id };
  if (req.scope !== 'company') Object.assign(f, byEmployee(req));
  const att = await Attendance.findOne(f);
  if (!att || att.correction?.status !== 'pending') throw ApiError.notFound('No pending correction');
  if (req.body.approve) {
    const company = await Company.findById(req.tenantId).select('hrSettings settings').lean();
    att.checkIn = att.correction.checkIn; att.checkOut = att.correction.checkOut; att.breaks = [];
    recompute(att, company);
  }
  att.correction.status = req.body.approve ? 'approved' : 'rejected';
  att.correction.reviewedBy = req.user._id;
  await att.save();
  const emp = await Employee.findOne({ company: req.tenantId, _id: att.employee }).select('user').lean();
  notify(req.tenantId, [emp?.user], { title: `Attendance correction ${att.correction.status}`, body: `Your correction for ${att.date} was ${att.correction.status}.`, link: '/app/me' });
  audit(req, `attendance.correction_${att.correction.status}`, { targetType: 'Attendance', targetId: att._id });
  res.json({ success: true, data: att });
}));

/* ---------------------------------- Leave ---------------------------------- */
async function balances(req, employeeId) {
  const year = new Date().getFullYear();
  const [types, used] = await Promise.all([
    LeaveType.find({ company: req.tenantId, active: true }).lean(),
    LeaveRequest.aggregate([{ $match: { company: req.tenantId, employee: oid(employeeId), status: { $in: ['approved', 'pending'] }, deletedAt: null, from: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) } } },
      { $group: { _id: { t: '$leaveType', s: '$status' }, days: { $sum: '$days' } } }]),
  ]);
  return types.map((t) => {
    const approved = used.find((u) => String(u._id.t) === String(t._id) && u._id.s === 'approved')?.days || 0;
    const pending = used.find((u) => String(u._id.t) === String(t._id) && u._id.s === 'pending')?.days || 0;
    return { leaveType: t, quota: t.annualQuota, used: approved, pending, available: Math.max(0, t.annualQuota - approved - pending) };
  });
}

r.get('/leaves/me/balance', guard({ permission: 'hrms.leave.view' }), h(async (req, res) => {
  res.json({ success: true, data: await balances(req, requireEmployee(req)._id) });
}));
r.get('/leaves/balance/:employeeId', guard({ permission: 'hrms.leave.view', minScope: 'team' }), h(async (req, res) => {
  res.json({ success: true, data: await balances(req, req.params.employeeId) });
}));

r.get('/leaves', guard({ permission: 'hrms.leave.view' }), h(async (req, res) => {
  const f = { company: req.tenantId };
  if (req.scope !== 'company' && req.scope !== 'department') Object.assign(f, req.query.mine === '1' ? { employee: req.employee?._id || null } : byEmployee(req));
  else if (req.query.mine === '1') f.employee = req.employee?._id || null;
  if (req.query.status && req.query.status !== 'all') f.status = req.query.status;
  const items = await LeaveRequest.find(f).sort({ createdAt: -1 }).limit(500)
    .populate({ path: 'employee', select: 'firstName lastName employeeId', match: { company: req.tenantId } })
    .populate({ path: 'leaveType', select: 'name color paid', match: { company: req.tenantId } }).lean();
  res.json({ success: true, data: items });
}));

const leaveSchema = z.object({ leaveType: z.string().regex(/^[a-f\d]{24}$/i), from: z.coerce.date(), to: z.coerce.date(), halfDay: z.boolean().optional(), reason: z.string().trim().max(500).optional() });
r.post('/leaves', guard({ permission: 'hrms.leave.create', write: true }), validate({ body: leaveSchema }), h(async (req, res) => {
  const emp = requireEmployee(req);
  if (req.body.to < req.body.from) throw ApiError.badRequest('End date must be on or after start date.');
  const [type, company, holidays] = await Promise.all([
    LeaveType.findOne({ company: req.tenantId, _id: req.body.leaveType, active: true }).lean(),
    Company.findById(req.tenantId).select('hrSettings').lean(),
    Holiday.find({ company: req.tenantId, date: { $gte: req.body.from, $lte: req.body.to } }).lean(),
  ]);
  if (!type) throw ApiError.badRequest('Leave type not found');
  const days = req.body.halfDay ? 0.5 : countLeaveDays(req.body.from, req.body.to, company.hrSettings?.weeklyOffs || [0], holidays.map((x) => ymd(x.date)));
  if (days <= 0) throw ApiError.badRequest('The selected dates are all holidays or weekly offs.');
  const overlap = await LeaveRequest.exists({ company: req.tenantId, employee: emp._id, status: { $in: ['pending', 'approved'] }, from: { $lte: req.body.to }, to: { $gte: req.body.from } });
  if (overlap) throw ApiError.conflict('You already have a leave request overlapping these dates.');
  const bal = (await balances(req, emp._id)).find((b) => String(b.leaveType._id) === String(type._id));
  if (type.paid && bal && days > bal.available) throw ApiError.badRequest(`Only ${bal.available} day(s) of ${type.name} available.`);
  const leave = await LeaveRequest.create({ ...req.body, company: req.tenantId, employee: emp._id, days });
  notify(req.tenantId, await managersOf(req, emp._id), { title: 'New leave request', body: `${emp.firstName} applied for ${days} day(s) of ${type.name}.`, link: '/app/hr/leaves', email: true });
  res.status(201).json({ success: true, data: leave });
}));

r.post('/leaves/:id/review', guard({ permission: 'hrms.leave.approve', write: true }), validate({ body: z.object({ approve: z.boolean(), note: z.string().max(500).optional() }) }), h(async (req, res) => {
  const f = { company: req.tenantId, _id: req.params.id, status: 'pending' };
  if (req.scope !== 'company' && req.scope !== 'department') Object.assign(f, byEmployee(req));
  const leave = await LeaveRequest.findOne(f);
  if (!leave) throw ApiError.notFound('Pending leave request not found');
  if (req.employee && String(leave.employee) === String(req.employee._id)) throw ApiError.forbidden('You cannot approve your own leave.');
  leave.status = req.body.approve ? 'approved' : 'rejected';
  Object.assign(leave, { reviewedBy: req.user._id, reviewNote: req.body.note, reviewedAt: new Date() });
  await leave.save();
  const emp = await Employee.findOne({ company: req.tenantId, _id: leave.employee }).select('user').lean();
  notify(req.tenantId, [emp?.user], { title: `Leave ${leave.status}`, body: `Your leave from ${ymd(leave.from)} to ${ymd(leave.to)} was ${leave.status}.${req.body.note ? ' Note: ' + req.body.note : ''}`, link: '/app/me', email: true });
  audit(req, `leave.${leave.status}`, { targetType: 'LeaveRequest', targetId: leave._id });
  res.json({ success: true, data: leave });
}));

r.post('/leaves/:id/cancel', guard({ permission: 'hrms.leave.create', write: true }), h(async (req, res) => {
  const leave = await LeaveRequest.findOne({ company: req.tenantId, _id: req.params.id, employee: req.employee?._id || null, status: 'pending' });
  if (!leave) throw ApiError.notFound('Pending leave request not found');
  leave.status = 'cancelled';
  await leave.save();
  res.json({ success: true, data: leave });
}));

/* ---------------------------- Employee requests ---------------------------- */
r.get('/requests', guard({ permission: 'hrms.document.view' }), h(async (req, res) => {
  const f = { company: req.tenantId };
  if (req.scope !== 'company') Object.assign(f, byEmployee(req));
  const items = await EmployeeRequest.find(f).sort({ createdAt: -1 }).limit(300).populate({ path: 'employee', select: 'firstName lastName employeeId', match: { company: req.tenantId } }).lean();
  res.json({ success: true, data: items });
}));
r.post('/requests', guard({ permission: 'hrms.document.create', write: true }),
  validate({ body: z.object({ type: z.enum(['document', 'salary_advance', 'asset', 'reimbursement', 'other']), subject: z.string().trim().min(3).max(150), details: z.string().max(2000).optional(), amount: z.coerce.number().min(0).optional() }) }),
  h(async (req, res) => {
    const emp = requireEmployee(req);
    const doc = await EmployeeRequest.create({ ...req.body, company: req.tenantId, employee: emp._id });
    notify(req.tenantId, await managersOf(req, emp._id), { title: 'New employee request', body: `${emp.firstName}: ${req.body.subject}`, link: '/app/hr/requests' });
    res.status(201).json({ success: true, data: doc });
  }));
r.post('/requests/:id/respond', guard({ permission: 'hrms.employee.edit', write: true }),
  validate({ body: z.object({ status: z.enum(['approved', 'rejected', 'closed']), response: z.string().max(1000).optional() }) }), h(async (req, res) => {
    const doc = await EmployeeRequest.findOne({ company: req.tenantId, _id: req.params.id });
    if (!doc) throw ApiError.notFound('Request not found');
    Object.assign(doc, req.body, { reviewedBy: req.user._id });
    await doc.save();
    const emp = await Employee.findOne({ company: req.tenantId, _id: doc.employee }).select('user').lean();
    notify(req.tenantId, [emp?.user], { title: `Request ${doc.status}`, body: `${doc.subject}${doc.response ? ' — ' + doc.response : ''}`, link: '/app/me' });
    res.json({ success: true, data: doc });
  }));

/* ------------------------------ HR settings ------------------------------- */
r.get('/settings', guard({ permission: 'hrms.settings.view' }), h(async (req, res) => {
  res.json({ success: true, data: (await Company.findById(req.tenantId).select('hrSettings').lean()).hrSettings || {} });
}));
r.patch('/settings', guard({ permission: 'hrms.settings.configure', write: true }), validate({ body: z.object({
  shiftStart: z.string().regex(/^\d{2}:\d{2}$/), shiftEnd: z.string().regex(/^\d{2}:\d{2}$/), graceMinutes: z.coerce.number().int().min(0).max(240),
  fullDayHours: z.coerce.number().min(1).max(24), halfDayHours: z.coerce.number().min(0).max(24), weeklyOffs: z.array(z.number().int().min(0).max(6)).max(7), employeeIdPrefix: z.string().max(10),
}).partial() }), h(async (req, res) => {
  const $set = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [`hrSettings.${k}`, v]));
  const c = await Company.findByIdAndUpdate(req.tenantId, { $set }, { new: true }).select('hrSettings').lean();
  audit(req, 'hr.settings_updated', { meta: req.body });
  res.json({ success: true, data: c.hrSettings });
}));

/* -------------------------- Create login for employee ---------------------- */
r.post('/employees/:id/create-login', guard({ permission: 'core.user.create', write: true, limit: { name: 'users', count: countSeats } }), h(async (req, res) => {
  const emp = await Employee.findOne({ company: req.tenantId, _id: req.params.id });
  if (!emp) throw ApiError.notFound('Employee not found');
  if (emp.user) throw ApiError.conflict('This employee already has a login.');
  if (!emp.email) throw ApiError.badRequest('Add an email address to the employee first.');
  const role = await Role.findOne({ company: req.tenantId, slug: 'employee' }).lean();
  // Reuse the standard invitation flow (seat limit is enforced there).
  req.body = { name: [emp.firstName, emp.lastName].filter(Boolean).join(' '), email: emp.email.toLowerCase(), phone: emp.phone, role: String(role._id), designation: emp.designation };
  req.linkEmployee = emp;
  return createUser(req, res);
}));

export default r;
