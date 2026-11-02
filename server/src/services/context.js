import { Company, Role, Subscription, Plan } from '../models/index.js';
import { computeSubscriptionState } from '../policy/subscription.js';
import { ALL_PERMISSION_KEYS } from '../policy/permissions.js';
import { effectiveLimit } from '../policy/engine.js';
import { getPlatformPolicy } from './platformPolicy.js';
import { env } from '../config/env.js';

/** Everything the frontend needs to render the right panel, menus and banners. */
export async function buildSessionPayload(user) {
  const safeUser = {
    _id: user._id, name: user.name, email: user.email, phone: user.phone, isSuperAdmin: !!user.isSuperAdmin,
    designation: user.designation, department: user.department, emailVerified: user.emailVerified, lastLoginAt: user.lastLoginAt,
  };
  if (user.isSuperAdmin) {
    return { user: safeUser, panel: 'super_admin', permissions: ['*'], support: env.support };
  }

  const platform = await getPlatformPolicy();
  const [company, role, subscription] = await Promise.all([
    Company.findById(user.company).lean(),
    Role.findOne({ _id: user.role, company: user.company }).lean(),
    Subscription.findOne({ company: user.company }).lean(),
  ]);
  const plan = subscription ? await Plan.findById(subscription.plan).lean() : null;
  const perms = role?.permissions || [];
  const permissions = perms.some((p) => p.key === '*')
    ? ALL_PERMISSION_KEYS.map((key) => ({ key, scope: 'company' }))
    : perms;

  const limits = {};
  for (const name of ['users', 'employees', 'invoicesPerMonth', 'storageMB', 'branches']) limits[name] = effectiveLimit(name, plan, company);

  return {
    user: safeUser,
    panel: 'company',
    company: company && {
      _id: company._id, name: company.name, slug: company.slug, status: company.status, logoUrl: company.logoUrl,
      gstin: company.gstin, businessType: company.businessType, settings: company.settings,
      suspension: company.status === 'suspended' || company.status === 'blocked' ? { reason: company.suspension?.reason, category: company.suspension?.category } : null,
    },
    role: role && { _id: role._id, name: role.name, slug: role.slug, locked: role.locked },
    permissions,
    subscription: {
      ...computeSubscriptionState(subscription, platform.subscription),
      status: subscription?.status || null,
      billingCycle: subscription?.billingCycle,
      plan: plan && { _id: plan._id, name: plan.name, slug: plan.slug, modules: plan.modules },
    },
    limits,
    maintenance: platform.maintenance?.enabled ? platform.maintenance : null,
    support: env.support,
  };
}
