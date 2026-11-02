import { Router } from 'express';
import * as c from '../controllers/company.controller.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { loadTenant, guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/common.js';
import * as v from '../validators/company.js';
import billingRoutes from './billing.routes.js';
import hrmsRoutes from './hrms.routes.js';
import payrollRoutes from './payroll.routes.js';
import tasksRoutes from './tasks.routes.js';
import workspaceRoutes from './workspace.routes.js';
import { companyPayments } from './payments.routes.js';

/**
 * Every company route runs:  authenticate → loadTenant (tenant isolation) → guard (policy engine:
 * account status, subscription, module, permission, limits) → validate → handler.
 */
const r = Router();
r.use(authenticate, loadTenant);

r.get('/dashboard', guard({}), h(c.dashboard));

r.get('/settings', guard({ permission: 'core.company.view' }), h(c.getSettings));
r.patch('/settings', guard({ permission: 'core.company.edit', write: true }), validate({ body: v.settingsSchema }), h(c.updateSettings));

r.get('/users', guard({ permission: 'core.user.view' }), validate({ query: listQuery }), h(c.listUsers));
r.post('/users', guard({ permission: 'core.user.create', write: true, limit: { name: 'users', count: c.countSeats } }),
  validate({ body: v.createUserSchema }), h(c.createUser));
r.patch('/users/:id', guard({ permission: 'core.user.edit', write: true }), validate({ params: idParam, body: v.updateUserSchema }), h(c.updateUser));
r.patch('/users/:id/status', guard({ permission: 'core.user.manage', write: true }), validate({ params: idParam, body: v.userStatusSchema }), h(c.setUserStatus));
r.post('/users/:id/resend-invite', guard({ permission: 'core.user.create', write: true }), validate({ params: idParam }), h(c.resendInvite));
r.delete('/users/:id', guard({ permission: 'core.user.delete', write: true }), validate({ params: idParam }), h(c.deleteUser));

r.get('/permissions', guard({ permission: 'core.role.view' }), h(c.permissionCatalog));
r.get('/roles', guard({ permission: 'core.role.view' }), h(c.listRoles));
r.post('/roles', guard({ permission: 'core.role.create', module: 'customRoles', write: true }), validate({ body: v.createRoleSchema }), h(c.createRole));
r.patch('/roles/:id', guard({ permission: 'core.role.edit', module: 'customRoles', write: true }), validate({ params: idParam, body: v.updateRoleSchema }), h(c.updateRole));
r.delete('/roles/:id', guard({ permission: 'core.role.delete', module: 'customRoles', write: true }), validate({ params: idParam }), h(c.deleteRole));

// Subscription endpoints stay reachable even when the subscription is expired/blocked so the company can renew.
r.get('/subscription', guard({ permission: 'core.subscription.view', subscriptionRoute: true }), h(c.getSubscription));

r.get('/audit-logs', guard({ permission: 'core.audit.view' }), validate({ query: listQuery }), h(c.listAuditLogs));

// Phase 2–5 modules. Each endpoint inside is guarded; module access is derived from the permission key.
r.use('/subscription', companyPayments);
r.use('/billing', billingRoutes);
r.use('/hr', hrmsRoutes);
r.use('/payroll', payrollRoutes);
r.use('/work', tasksRoutes);
r.use('/', workspaceRoutes);

export default r;
