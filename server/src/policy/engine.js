import { computeSubscriptionState } from './subscription.js';
import { MODULES, SCOPE_RANK, moduleOfKey } from './permissions.js';

/**
 * Central policy engine. Pure and synchronous: callers load the context, the engine decides.
 *
 * ctx = { user, role, company, subscription, plan, platform, now }
 * req = {
 *   permission?: 'billing.invoice.create',
 *   module?: 'billing',            // defaults to the permission's module
 *   write?: boolean,               // mutating operation
 *   export?: boolean,              // data export (allowed while expired if policy says so)
 *   subscriptionRoute?: boolean,   // renewal/plan endpoints that must work even when blocked
 *   limit?: { name: 'users', current: 4, adding?: 1 },
 *   minScope?: 'company'
 * }
 * returns { allowed: true, scope, subscription } | { allowed: false, status, code, reason, details }
 */
const deny = (status, code, reason, details) => ({ allowed: false, status, code, reason, details });

export function resolvePermission(role, key) {
  if (!role || !Array.isArray(role.permissions)) return null;
  let best = null;
  for (const p of role.permissions) {
    if (p.key === '*' || p.key === key) {
      if (!best || SCOPE_RANK[p.scope] > SCOPE_RANK[best]) best = p.scope;
    }
  }
  return best;
}

export function effectiveLimit(name, plan, company) {
  const override = company?.limitOverrides?.[name];
  if (override !== null && override !== undefined) return override;
  const v = plan?.limits?.[name];
  return v === undefined || v === null ? -1 : v;
}

export function evaluate(ctx, req = {}) {
  const { user, role, company, plan, platform = {}, now = new Date() } = ctx;

  // 1. Authentication & account status
  if (!user) return deny(401, 'UNAUTHORIZED', 'Authentication required');
  if (user.status !== 'active') return deny(403, 'ACCOUNT_INACTIVE', 'Your user account is not active. Contact your company administrator.');

  // 2. Super Admin never acts as a tenant user — platform routes use requireSuperAdmin instead.
  if (user.isSuperAdmin) return deny(403, 'NOT_TENANT_USER', 'Super Admin accounts manage tenants from the admin panel.');

  // 3. Tenant ownership
  if (!company || String(user.company) !== String(company._id)) {
    return deny(403, 'TENANT_MISMATCH', 'Access to this workspace is not allowed.');
  }

  // 4. Platform maintenance
  if (platform.maintenance?.enabled) return deny(503, 'MAINTENANCE', platform.maintenance.message);

  // 5. Company account status
  if (company.deletedAt) return deny(403, 'COMPANY_DELETED', 'This workspace has been closed.');
  if (company.status === 'pending') {
    return deny(403, 'COMPANY_PENDING', 'Your company registration is awaiting approval by the GO SOFT team.');
  }
  if (company.status === 'suspended' || company.status === 'blocked') {
    return deny(403, company.status === 'blocked' ? 'COMPANY_BLOCKED' : 'COMPANY_SUSPENDED',
      `This workspace has been ${company.status}.`,
      { reason: company.suspension?.reason || null, category: company.suspension?.category || null });
  }

  // 6. Subscription
  const sub = computeSubscriptionState(ctx.subscription, platform.subscription, now);
  if (!req.subscriptionRoute) {
    if (sub.state === 'none' || sub.state === 'blocked') {
      return deny(402, 'SUBSCRIPTION_REQUIRED', sub.warning, { subscription: sub });
    }
    if (!sub.canWrite) {
      if (req.export && platform.subscription?.allowExportWhenExpired === false) {
        return deny(402, 'SUBSCRIPTION_EXPIRED', 'Exports are disabled while the subscription is expired.', { subscription: sub });
      }
      if (req.write) return deny(402, 'SUBSCRIPTION_EXPIRED', sub.warning, { subscription: sub });
    }
  }

  // 7. Module access by plan
  const module = req.module || (req.permission ? moduleOfKey(req.permission) : null);
  if (module && !MODULES[module]?.alwaysOn && !(plan?.modules || []).includes(module)) {
    return deny(403, 'MODULE_NOT_IN_PLAN', `${MODULES[module]?.label || module} is not included in your current plan. Upgrade to unlock it.`, { module });
  }

  // 8. Role permission
  let scope = null;
  if (req.permission) {
    scope = resolvePermission(role, req.permission);
    if (!scope) return deny(403, 'PERMISSION_DENIED', 'Your role does not allow this action.', { permission: req.permission });
    if (req.minScope && SCOPE_RANK[scope] < SCOPE_RANK[req.minScope]) {
      return deny(403, 'SCOPE_DENIED', 'Your role does not allow this action at this scope.', { permission: req.permission, scope });
    }
  }

  // 9. Usage limits
  if (req.limit) {
    const max = effectiveLimit(req.limit.name, plan, company);
    const adding = req.limit.adding ?? 1;
    if (max !== -1 && req.limit.current + adding > max) {
      return deny(403, 'LIMIT_REACHED', `Your plan allows up to ${max} ${req.limit.name}. Upgrade to add more.`,
        { limit: req.limit.name, max, current: req.limit.current });
    }
  }

  return { allowed: true, scope, subscription: sub };
}
