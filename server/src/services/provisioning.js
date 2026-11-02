import { Company, User, Role, Subscription, Plan, LeaveType, Department } from '../models/index.js';
import { DEFAULT_ROLE_TEMPLATES } from '../policy/permissions.js';
import { slugify } from '../utils/slug.js';
import { randomToken } from '../utils/tokens.js';

const DAY = 24 * 60 * 60 * 1000;

async function uniqueCompanySlug(name) {
  const base = slugify(name) || 'company';
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${randomToken(2)}`;
    if (!(await Company.exists({ slug }))) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function createDefaultRoles(companyId) {
  return Role.insertMany(DEFAULT_ROLE_TEMPLATES.map((t) => ({
    company: companyId, name: t.name, slug: t.slug, description: t.description,
    isSystem: true, locked: t.locked, permissions: t.permissions,
  })));
}

/**
 * Creates a complete tenant workspace: company, default roles, owner user and trial subscription.
 * MongoDB transactions need a replica set, so on failure we roll back manually.
 */
export async function provisionCompany({ company: c, owner: o, plan, trialDays, status = 'active', emailVerified = false }) {
  const created = { company: null, roles: false, user: null };
  try {
    const company = await Company.create({
      name: c.name, slug: await uniqueCompanySlug(c.name), email: o.email, phone: c.phone,
      businessType: c.businessType, industry: c.industry, gstin: c.gstin || undefined, status,
    });
    created.company = company;

    const roles = await createDefaultRoles(company._id);
    created.roles = true;
    const ownerRole = roles.find((r) => r.slug === 'company-owner');

    const user = new User({
      company: company._id, name: o.name, email: o.email, phone: c.phone, role: ownerRole._id,
      status: 'active', emailVerified, designation: 'Owner',
    });
    await user.setPassword(o.password);
    await user.save();
    created.user = user;

    company.owner = user._id;
    await company.save();
    await createDefaultHrData(company._id);

    let subscription = null;
    if (plan) {
      const days = trialDays ?? plan.trialDays ?? 14;
      subscription = await Subscription.create({
        company: company._id, plan: plan._id, status: 'trialing', billingCycle: 'monthly',
        trialEndsAt: new Date(Date.now() + days * DAY),
        history: [{ event: 'trial_started', plan: plan._id, note: `${days}-day free trial` }],
      });
    }
    return { company, user, subscription };
  } catch (err) {
    if (created.user) await User.deleteOne({ _id: created.user._id });
    if (created.roles) {
      for (const M of [Role, LeaveType, Department]) await M.deleteMany({ company: created.company._id }).setOptions({ withDeleted: true });
    }
    if (created.company) await Company.deleteOne({ _id: created.company._id });
    throw err;
  }
}

/** Sensible HR defaults so a new workspace works out of the box (editable later). */
export async function createDefaultHrData(companyId) {
  await LeaveType.insertMany([
    { company: companyId, name: 'Casual Leave', code: 'CL', annualQuota: 12, paid: true, color: '#1E4FD8' },
    { company: companyId, name: 'Sick Leave', code: 'SL', annualQuota: 7, paid: true, color: '#10B981' },
    { company: companyId, name: 'Earned Leave', code: 'EL', annualQuota: 15, paid: true, carryForward: true, color: '#8B5CF6' },
    { company: companyId, name: 'Loss of Pay', code: 'LOP', annualQuota: 365, paid: false, color: '#F59E0B' },
  ]);
  await Department.insertMany(['Management', 'Sales', 'Accounts', 'Operations'].map((name) => ({ company: companyId, name })));
}

export async function resolveTrialPlan(planSlug, platform) {
  const filter = { isArchived: false, isPublic: true };
  if (planSlug) {
    const p = await Plan.findOne({ ...filter, slug: planSlug }).lean();
    if (p) return p;
  }
  return (await Plan.findOne({ ...filter, slug: platform.trial?.defaultPlanSlug }).lean())
    || Plan.findOne(filter).sort({ sortOrder: 1 }).lean();
}
