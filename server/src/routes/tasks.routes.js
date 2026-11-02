import { Router } from 'express';
import { z } from 'zod';
import { Project, Task, User } from '../models/index.js';
import { crudRouter } from '../services/crud.js';
import { guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { resolvePermission } from '../policy/engine.js';
import { notify } from '../services/notify.js';

const r = Router();
r.use(h(async (req, _res, next) => {
  req.teamUserIds = [req.user._id, ...(await User.find({ company: req.tenantId, manager: req.user._id, deletedAt: null }).distinct('_id'))];
  next();
}));

const sameCompanyUsers = async (req, ids = []) => {
  const list = [].concat(ids).filter(Boolean);
  if (!list.length) return [];
  const found = await User.find({ _id: { $in: list }, company: req.tenantId, deletedAt: null }).distinct('_id');
  if (found.length !== new Set(list.map(String)).size) throw ApiError.badRequest('One or more selected users are not in this company.');
  return found;
};

async function updateProgress(req, projectId) {
  if (!projectId) return;
  const [total, done] = await Promise.all([
    Task.countDocuments({ company: req.tenantId, project: projectId }),
    Task.countDocuments({ company: req.tenantId, project: projectId, status: 'completed' }),
  ]);
  await Project.updateOne({ company: req.tenantId, _id: projectId }, { progress: total ? Math.round((done / total) * 100) : 0 });
}

r.use('/projects', crudRouter(Project, {
  perm: 'tasks.project', search: ['name', 'code', 'description'], filters: ['status', 'priority'], sort: { createdAt: -1 },
  ownFilter: (req) => ({ $or: [{ manager: req.user._id }, { members: req.user._id }, { createdBy: req.user._id }] }),
  populate: [{ path: 'manager', select: 'name' }, { path: 'members', select: 'name' }, { path: 'client', select: 'name' }],
  beforeSave: async (req, data, existing) => {
    if (data.members) data.members = await sameCompanyUsers(req, data.members);
    if (data.manager) await sameCompanyUsers(req, [data.manager]);
    if (!existing) data.createdBy = req.user._id;
    return data;
  },
  afterSave: (req, doc, isNew) => isNew && notify(req.tenantId, [doc.manager, ...(doc.members || [])].filter((u) => String(u) !== String(req.user._id)),
    { title: 'Added to a project', body: `You were added to project "${doc.name}".`, link: '/app/tasks' }),
}));

r.use('/tasks', crudRouter(Task, {
  perm: 'tasks.task', search: ['title', 'description'], filters: ['status', 'priority', 'project'], sort: { order: 1, dueDate: 1, createdAt: -1 },
  ownFilter: (req) => (req.scope === 'team'
    ? { $or: [{ assignees: { $in: req.teamUserIds } }, { createdBy: req.user._id }] }
    : { $or: [{ assignees: req.user._id }, { createdBy: req.user._id }] }),
  populate: [{ path: 'assignees', select: 'name' }, { path: 'project', select: 'name' }, { path: 'approver', select: 'name' }],
  fields: ['title', 'description', 'project', 'assignees', 'approver', 'status', 'priority', 'startDate', 'dueDate', 'reminderAt', 'order', 'checklist', 'attachments'],
  beforeSave: async (req, data, existing) => {
    if (data.assignees) data.assignees = await sameCompanyUsers(req, data.assignees);
    if (data.approver) await sameCompanyUsers(req, [data.approver]);
    if (data.project && !(await Project.exists({ company: req.tenantId, _id: data.project }))) throw ApiError.badRequest('Project not found');
    // Approval workflow: completing a task that has an approver sends it to review unless you can approve.
    if (data.status === 'completed' && existing?.status !== 'completed') {
      const approverId = data.approver || existing?.approver;
      const canApprove = resolvePermission(req.ctx.role, 'tasks.task.approve') || (approverId && String(approverId) === String(req.user._id));
      if (approverId && !canApprove) data.status = 'review';
    }
    if (data.status === 'completed') data.completedAt = existing?.completedAt || new Date();
    const changes = [];
    if (!existing) { data.createdBy = req.user._id; changes.push('created'); } else {
      if (data.status && data.status !== existing.status) changes.push(`status: ${existing.status} → ${data.status}`);
      if (data.assignees && String(data.assignees) !== String(existing.assignees)) changes.push('assignees changed');
      if (data.dueDate && String(new Date(data.dueDate)) !== String(existing.dueDate)) changes.push('due date changed');
    }
    if (changes.length) {
      const history = existing ? [...existing.history] : [];
      history.push({ user: req.user.name, change: changes.join(', ') });
      data.history = history.slice(-50);
    }
    req._prevAssignees = existing ? existing.assignees.map(String) : [];
    req._prevStatus = existing?.status;
    return data;
  },
  afterSave: async (req, doc) => {
    const added = doc.assignees.map(String).filter((u) => !req._prevAssignees.includes(u) && u !== String(req.user._id));
    if (added.length) notify(req.tenantId, added, { title: 'New task assigned', body: doc.title, link: '/app/tasks', email: true });
    if (doc.status === 'review' && req._prevStatus !== 'review' && doc.approver) notify(req.tenantId, [doc.approver], { title: 'Task awaiting approval', body: doc.title, link: '/app/tasks' });
    if (doc.status === 'completed' && req._prevStatus !== 'completed') notify(req.tenantId, [doc.createdBy].filter((u) => String(u) !== String(req.user._id)), { title: 'Task completed', body: doc.title, link: '/app/tasks' });
    await updateProgress(req, doc.project);
  },
  beforeDelete: async (req, doc) => { setImmediate(() => updateProgress(req, doc.project).catch(() => {})); },
}));

r.post('/tasks/:id/comments', guard({ permission: 'tasks.task.view' }), validate({ body: z.object({ text: z.string().trim().min(1).max(2000) }) }), h(async (req, res) => {
  const f = { company: req.tenantId, _id: req.params.id };
  if (req.scope !== 'company' && req.scope !== 'department') f.$or = [{ assignees: { $in: req.scope === 'team' ? req.teamUserIds : [req.user._id] } }, { createdBy: req.user._id }];
  const task = await Task.findOne(f);
  if (!task) throw ApiError.notFound('Task not found');
  task.comments.push({ user: req.user._id, userName: req.user.name, text: req.body.text });
  await task.save();
  const others = [...task.assignees, task.createdBy].map(String).filter((u) => u !== String(req.user._id));
  notify(req.tenantId, others, { title: `New comment on "${task.title}"`, body: req.body.text.slice(0, 140), link: '/app/tasks' });
  res.status(201).json({ success: true, data: task.comments.at(-1) });
}));

/** Lightweight user directory for pickers (assignees, managers). */
r.get('/people', guard({ module: 'tasks' }), h(async (req, res) => {
  res.json({ success: true, data: await User.find({ company: req.tenantId, deletedAt: null, status: { $ne: 'inactive' } }).select('name email designation').sort({ name: 1 }).lean() });
}));

export default r;
