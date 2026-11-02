import { Router } from 'express';
import * as c from '../controllers/admin.controller.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/common.js';
import * as v from '../validators/admin.js';

const r = Router();
r.use(authenticate, requireSuperAdmin);

r.get('/dashboard', h(c.dashboard));
r.get('/meta', h(c.meta));

r.get('/companies', validate({ query: listQuery }), h(c.listCompanies));
r.get('/companies/:id', validate({ params: idParam }), h(c.getCompany));
r.patch('/companies/:id/status', validate({ params: idParam, body: v.statusSchema }), h(c.changeCompanyStatus));
r.post('/companies/:id/trial', validate({ params: idParam, body: v.trialSchema }), h(c.extendTrial));
r.patch('/companies/:id/subscription', validate({ params: idParam, body: v.subscriptionSchema }), h(c.updateCompanySubscription));
r.patch('/companies/:id/limits', validate({ params: idParam, body: v.limitsSchema }), h(c.updateCompanyLimits));

r.get('/plans', h(c.listPlans));
r.post('/plans', validate({ body: v.createPlanSchema }), h(c.createPlan));
r.patch('/plans/:id', validate({ params: idParam, body: v.updatePlanSchema }), h(c.updatePlan));
r.patch('/plans/:id/archive', validate({ params: idParam, body: v.archiveSchema }), h(c.archivePlan));

r.get('/policies', h(c.getPolicies));
r.patch('/policies', validate({ body: v.policiesSchema }), h(c.updatePolicies));

r.get('/audit-logs', validate({ query: listQuery }), h(c.listAuditLogs));
r.get('/leads', validate({ query: listQuery }), h(c.listLeads));
r.patch('/leads/:id', validate({ params: idParam, body: v.leadStatusSchema }), h(c.updateLead));

export default r;
