import { Router } from 'express';
import { z } from 'zod';
import { Announcement, Notification, User, Employee, Task, LeaveRequest, Attendance, Invoice } from '../models/index.js';
import { crudRouter } from '../services/crud.js';
import { guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { notify } from '../services/notify.js';
import { resolvePermission } from '../policy/engine.js';
import { ymd } from '../policy/attendance.js';

/** Cross-module workspace features: announcements, notifications, employee home, analytics. */
const r = Router();

r.use('/announcements', crudRouter(Announcement, {
  perm: 'core.announcement', search: ['title', 'body'], sort: { pinned: -1, createdAt: -1 },
  beforeSave: (req, data, existing) => { if (!existing) data.createdBy = req.user._id; return data; },
  afterSave: async (req, doc, isNew) => {
    if (!isNew) return;
    const users = await User.find({ company: req.tenantId, status: 'active', deletedAt: null, _id: { $ne: req.user._id } }).distinct('_id');
    notify(req.tenantId, users, { title: `📢 ${doc.title}`, body: doc.body?.slice(0, 200), link: '/app/me' });
  },
}));

r.get('/notifications', guard({}), h(async (req, res) => {
  const f = { company: req.tenantId, user: req.user._id };
  const [items, unread] = await Promise.all([Notification.find(f).sort({ createdAt: -1 }).limit(30).lean(), Notification.countDocuments({ ...f, readAt: null })]);
  res.json({ success: true, data: items, unread });
}));
r.post('/notifications/read', guard({}), validate({ body: z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100).optional() }) }), h(async (req, res) => {
  const f = { company: req.tenantId, user: req.user._id, readAt: null };
  if (req.body.ids?.length) f._id = { $in: req.body.ids };
  await Notification.updateMany(f, { readAt: new Date() });
  res.json({ success: true });
}));

/** Employee self-service home: profile, today's attendance, pending items, announcements. */
r.get('/me/home', guard({}), h(async (req, res) => {
  const emp = req.employee ? await Employee.findOne({ company: req.tenantId, _id: req.employee._id })
    .populate({ path: 'department', select: 'name', match: { company: req.tenantId } }).populate({ path: 'reportingManager', select: 'firstName lastName', match: { company: req.tenantId } })
    .select('-salary -bank -panEnc').lean() : null;
  const tz = req.ctx.company.settings?.timezone;
  const [announcements, myTasks, today, leaves] = await Promise.all([
    Announcement.find({ company: req.tenantId, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort({ pinned: -1, createdAt: -1 }).limit(5).lean(),
    req.ctx.plan?.modules?.includes('tasks') ? Task.find({ company: req.tenantId, assignees: req.user._id, status: { $nin: ['completed'] } }).sort({ dueDate: 1 }).limit(8).select('title status priority dueDate').lean() : [],
    emp ? Attendance.findOne({ company: req.tenantId, employee: emp._id, date: ymd(new Date(), tz) }).lean() : null,
    emp ? LeaveRequest.find({ company: req.tenantId, employee: emp._id }).sort({ createdAt: -1 }).limit(5).populate({ path: 'leaveType', select: 'name color', match: { company: req.tenantId } }).lean() : [],
  ]);
  res.json({ success: true, data: { employee: emp, announcements, myTasks, today, leaves } });
}));

/** Company analytics dashboard (Business/Enterprise "analytics" module). */
r.get('/analytics', guard({ permission: 'analytics.dashboard.view' }), h(async (req, res) => {
  const c = req.tenantId;
  const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
  const can = (k) => !!resolvePermission(req.ctx.role, k);
  const mods = req.ctx.plan?.modules || [];
  const [revenue, headcount, taskStats, attendance] = await Promise.all([
    mods.includes('billing') && can('billing.invoice.view') ? Invoice.aggregate([{ $match: { company: c, type: 'invoice', status: { $ne: 'cancelled' }, deletedAt: null, date: { $gte: since } } }, { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, v: { $sum: '$grandTotal' } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]) : [],
    mods.includes('hrms') && can('hrms.employee.view') ? Employee.aggregate([{ $match: { company: c, deletedAt: null, status: { $ne: 'exited' } } }, { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'd' } }, { $group: { _id: { $ifNull: [{ $first: '$d.name' }, 'Unassigned'] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]) : [],
    mods.includes('tasks') && can('tasks.task.view') ? Task.aggregate([{ $match: { company: c, deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]) : [],
    mods.includes('hrms') && can('hrms.attendance.view') ? Attendance.aggregate([{ $match: { company: c, deletedAt: null, date: { $gte: ymd(new Date(Date.now() - 30 * 864e5)) } } }, { $group: { _id: '$date', present: { $sum: { $cond: [{ $in: ['$status', ['present', 'half_day']] }, 1, 0] } }, late: { $sum: { $cond: [{ $gt: ['$lateMinutes', 0] }, 1, 0] } } } }, { $sort: { _id: 1 } }]) : [],
  ]);
  res.json({ success: true, data: {
    revenue: revenue.map((m) => ({ month: new Date(m._id.y, m._id.m - 1, 1).toLocaleString('en-IN', { month: 'short' }), value: Math.round(m.v) })),
    headcount: headcount.map((d) => ({ name: d._id, value: d.n })),
    tasks: Object.fromEntries(taskStats.map((t) => [t._id, t.n])),
    attendance: attendance.map((a) => ({ date: a._id.slice(5), present: a.present, late: a.late })),
  } });
}));

export default r;
