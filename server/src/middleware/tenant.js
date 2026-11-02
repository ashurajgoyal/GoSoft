import { Company, Role, Subscription, Plan, Employee } from '../models/index.js';
import { getPlatformPolicy } from '../services/platformPolicy.js';
import { evaluate } from '../policy/engine.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Tenant isolation middleware. The tenant is ALWAYS derived from the authenticated user,
 * never from a header, URL or body — so a user can only ever reach their own company.
 * Loads the policy context once per request into req.ctx.
 */
export const loadTenant = asyncHandler(async (req, _res, next) => {
  const user = req.user;
  if (user.isSuperAdmin || !user.company) throw ApiError.forbidden('This endpoint is for company workspaces', 'NOT_TENANT_USER');

  const companyId = user.company;
  const [company, role, subscription, platform] = await Promise.all([
    Company.findById(companyId).lean(),
    user.role ? Role.findOne({ _id: user.role, company: companyId }).lean() : null,
    Subscription.findOne({ company: companyId }).lean(),
    getPlatformPolicy(),
  ]);
  if (!company) throw ApiError.forbidden('Workspace not found', 'TENANT_MISMATCH');
  const [plan, employee] = await Promise.all([
    subscription ? Plan.findById(subscription.plan).lean() : null,
    Employee.findOne({ company: companyId, user: user._id }).select('_id firstName lastName employeeId department reportingManager').lean(),
  ]);

  req.tenantId = company._id;
  req.employee = employee; // the caller's own employee record (self-service, own-scope filters)
  req.ctx = { user, role, company, subscription, plan, platform };
  next();
});

/**
 * Composite guard: runs authorization, account-status, subscription, module, permission
 * and limit checks through the central policy engine.
 *
 *   guard({ permission: 'core.user.create', write: true, limit: { name: 'users', count: (req) => ... } })
 */
export function guard(spec = {}) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.ctx) throw new Error('guard() used before loadTenant');
    const request = { ...spec };
    if (spec.limit) {
      const current = await spec.limit.count(req);
      request.limit = { name: spec.limit.name, current, adding: spec.limit.adding };
    }
    const decision = evaluate(req.ctx, request);
    if (!decision.allowed) throw new ApiError(decision.status, decision.reason, decision.code, decision.details);
    req.scope = decision.scope;
    req.subscriptionState = decision.subscription;
    next();
  });
}
