import mongoose from 'mongoose';
import { Company, User, Role, Plan, Subscription, AuditLog, Lead, RefreshToken } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate, pageMeta, escapeRegex } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';
import { computeSubscriptionState } from '../policy/subscription.js';
import { MODULES, RESOURCES, SCOPES } from '../policy/permissions.js';
import { getPlatformPolicy, invalidatePlatformPolicy } from '../services/platformPolicy.js';
import { PlatformPolicy } from '../models/index.js';
import { audit } from '../services/audit.js';
import { mails } from '../services/mailer.js';

const DAY = 24 * 60 * 60 * 1000;
const monthlyValue = (sub, plan) => (!plan ? 0 : sub.billingCycle === 'annual' ? plan.priceAnnual / 12 : plan.priceMonthly);

/* ------------------------------- Dashboard ------------------------------- */
export async function dashboard(_req, res) {
  const platform = await getPlatformPolicy();
  const now = new Date();
  const since30 = new Date(now - 30 * DAY);
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [statusCounts, totalUsers, newRegistrations, subs, plans, growth, cancelled30] = await Promise.all([
    Company.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.countDocuments({ isSuperAdmin: false, deletedAt: null }),
    Company.countDocuments({ createdAt: { $gte: since30 }, deletedAt: null }),
    Subscription.find().lean(),
    Plan.find().lean(),
    Company.aggregate([
      { $match: { createdAt: { $gte: yearAgo }, deletedAt: null } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 } } },
    ]),
    Subscription.countDocuments({ cancelledAt: { $gte: since30 } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.n]));
  const planById = new Map(plans.map((p) => [String(p._id), p]));
  let trial = 0; let active = 0; let expired = 0; let mrr = 0;
  const planDistribution = {};
  for (const s of subs) {
    const state = computeSubscriptionState(s, platform.subscription, now).state;
    const plan = planById.get(String(s.plan));
    if (state === 'trialing') trial++;
    else if (state === 'active') { active++; mrr += monthlyValue(s, plan); }
    else expired++;
    if (plan && (state === 'active' || state === 'trialing')) planDistribution[plan.name] = (planDistribution[plan.name] || 0) + 1;
  }

  const series = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hit = growth.find((g) => g._id.y === d.getFullYear() && g._id.m === d.getMonth() + 1);
    series.push({ month: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), registrations: hit?.n || 0 });
  }

  const totalCompanies = Object.values(byStatus).reduce((a, b) => a + b, 0);
  res.json({
    success: true,
    data: {
      companies: { total: totalCompanies, active: byStatus.active || 0, pending: byStatus.pending || 0, suspended: byStatus.suspended || 0, blocked: byStatus.blocked || 0, trial },
      users: { total: totalUsers },
      employees: { total: null, note: 'Available with the HRMS module (Phase 3)' },
      subscriptions: { active, expired, trial, cancellationsLast30: cancelled30 },
      revenue: {
        mrr: Math.round(mrr), arr: Math.round(mrr * 12),
        total: null, failedPayments: null, refunds: null, paymentSuccessRate: null,
        note: 'Payment metrics are populated once Cashfree is connected (Phase 2).',
      },
      churnRate: active + cancelled30 ? +((cancelled30 / (active + cancelled30)) * 100).toFixed(1) : 0,
      newRegistrations,
      growth: series,
      planDistribution: Object.entries(planDistribution).map(([name, value]) => ({ name, value })),
    },
  });
}

/* ------------------------------- Companies ------------------------------- */
export async function listCompanies(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const filter = { deletedAt: null };
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { slug: rx }, { gstin: rx }];
  }
  if (req.query.plan) {
    const plan = await Plan.findOne({ slug: req.query.plan }).lean();
    const ids = plan ? await Subscription.find({ plan: plan._id }).distinct('company') : [];
    filter._id = { $in: ids };
  }

  const [items, total, platform] = await Promise.all([
    Company.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('owner', 'name email').lean(),
    Company.countDocuments(filter),
    getPlatformPolicy(),
  ]);
  const ids = items.map((c) => c._id);
  const [subs, userCounts] = await Promise.all([
    Subscription.find({ company: { $in: ids } }).populate('plan', 'name slug').lean(),
    User.aggregate([{ $match: { company: { $in: ids }, deletedAt: null } }, { $group: { _id: '$company', n: { $sum: 1 } } }]),
  ]);
  const subBy = new Map(subs.map((s) => [String(s.company), s]));
  const usersBy = new Map(userCounts.map((u) => [String(u._id), u.n]));

  res.json({
    success: true,
    data: items.map((c) => {
      const s = subBy.get(String(c._id));
      return { ...c, users: usersBy.get(String(c._id)) || 0, plan: s?.plan || null, subscription: computeSubscriptionState(s, platform.subscription) };
    }),
    meta: pageMeta(total, { page, limit }),
  });
}

export async function getCompany(req, res) {
  const company = await Company.findById(req.params.id).populate('owner', 'name email phone lastLoginAt').lean();
  if (!company) throw ApiError.notFound('Company not found');
  const platform = await getPlatformPolicy();
  const [subscription, users, roles, activity] = await Promise.all([
    Subscription.findOne({ company: company._id }).populate('plan').populate('history.by', 'name').lean(),
    User.find({ company: company._id, deletedAt: null }).select('name email status lastLoginAt designation role').populate({ path: 'role', select: 'name', match: { company: company._id } }).sort({ createdAt: 1 }).limit(50).lean(),
    Role.countDocuments({ company: company._id }),
    AuditLog.find({ company: company._id }).sort({ createdAt: -1 }).limit(25).lean(),
  ]);
  res.json({
    success: true,
    data: {
      company, users, rolesCount: roles, activity,
      subscription: subscription && { ...subscription, effective: computeSubscriptionState(subscription, platform.subscription) },
      usage: { users: users.length, storageMB: company.usage?.storageMB || 0 },
    },
  });
}

const STATUS_TRANSITIONS = {
  activate: { from: ['pending'], to: 'active' },
  suspend: { from: ['active', 'pending'], to: 'suspended' },
  reactivate: { from: ['suspended', 'blocked'], to: 'active' },
  block: { from: ['active', 'pending', 'suspended'], to: 'blocked' },
};

export async function changeCompanyStatus(req, res) {
  const { action, reason, category } = req.body;
  const company = await Company.findById(req.params.id);
  if (!company) throw ApiError.notFound('Company not found');
  const t = STATUS_TRANSITIONS[action];
  if (!t.from.includes(company.status)) throw ApiError.badRequest(`Cannot ${action} a company that is ${company.status}.`);
  if ((action === 'suspend' || action === 'block') && !reason) throw ApiError.badRequest('A reason is required.');

  const previous = company.status;
  company.status = t.to;
  if (t.to === 'suspended' || t.to === 'blocked') {
    company.suspension = { category: category || 'administrative', reason, at: new Date(), by: req.user._id };
  } else {
    company.suspension = undefined;
  }
  await company.save();

  if (t.to === 'blocked') {
    // Blocked companies lose every live session immediately.
    const ids = await User.find({ company: company._id }).distinct('_id');
    await User.updateMany({ _id: { $in: ids } }, { $inc: { tokenVersion: 1 } });
    await RefreshToken.updateMany({ user: { $in: ids }, revokedAt: null }, { revokedAt: new Date() });
  }

  audit(req, `company.${action}`, { company: company._id, targetType: 'Company', targetId: company._id,
    summary: `${company.name}: ${previous} → ${t.to}`, meta: { reason, category } });
  mails.companyStatus(company.email, company.name, t.to, reason).catch(() => {});
  res.json({ success: true, data: company });
}

export async function extendTrial(req, res) {
  const sub = await Subscription.findOne({ company: req.params.id });
  if (!sub) throw ApiError.notFound('This company has no subscription yet.');
  const base = sub.status === 'trialing' && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
  sub.status = 'trialing';
  sub.trialEndsAt = new Date(base.getTime() + req.body.days * DAY);
  sub.history.push({ event: 'trial_extended', plan: sub.plan, by: req.user._id, note: `+${req.body.days} days${req.body.note ? ` — ${req.body.note}` : ''}` });
  await sub.save();
  audit(req, 'subscription.trial_extended', { company: sub.company, targetType: 'Subscription', targetId: sub._id, meta: { days: req.body.days } });
  res.json({ success: true, data: sub });
}

/** Manual subscription management (offline payments, comps, corrections). Cashfree automates this in Phase 2. */
export async function updateCompanySubscription(req, res) {
  const { planId, status, billingCycle, periodEnd, graceDaysOverride, note } = req.body;
  const company = await Company.findById(req.params.id).lean();
  if (!company) throw ApiError.notFound('Company not found');
  let sub = await Subscription.findOne({ company: company._id });
  const plan = planId ? await Plan.findById(planId).lean() : null;
  if (planId && !plan) throw ApiError.badRequest('Plan not found');
  if (!sub && !plan) throw ApiError.badRequest('Select a plan to create the subscription.');
  if (!sub) sub = new Subscription({ company: company._id, plan: plan._id });

  const events = [];
  if (plan && String(sub.plan) !== String(plan._id)) { events.push(`plan → ${plan.name}`); sub.plan = plan._id; }
  if (billingCycle) sub.billingCycle = billingCycle;
  if (status) {
    events.push(`status → ${status}`);
    sub.status = status;
    if (status === 'active') {
      sub.currentPeriodStart = new Date();
      sub.currentPeriodEnd = periodEnd ? new Date(periodEnd) : new Date(Date.now() + (sub.billingCycle === 'annual' ? 365 : 30) * DAY);
      sub.cancelAtPeriodEnd = false;
    }
    if (status === 'cancelled') { sub.cancelledAt = new Date(); sub.cancelAtPeriodEnd = true; }
    if (status === 'expired') sub.currentPeriodEnd = sub.currentPeriodEnd && sub.currentPeriodEnd < new Date() ? sub.currentPeriodEnd : new Date();
  } else if (periodEnd) { sub.currentPeriodEnd = new Date(periodEnd); events.push('period end changed'); }
  if (graceDaysOverride !== undefined) sub.graceDaysOverride = graceDaysOverride;
  sub.history.push({ event: 'admin_update', plan: sub.plan, by: req.user._id, note: [events.join(', '), note].filter(Boolean).join(' — ') });
  await sub.save();

  audit(req, 'subscription.admin_update', { company: company._id, targetType: 'Subscription', targetId: sub._id, summary: events.join(', '), meta: req.body });
  res.json({ success: true, data: sub });
}

export async function updateCompanyLimits(req, res) {
  const company = await Company.findById(req.params.id);
  if (!company) throw ApiError.notFound('Company not found');
  for (const [k, v] of Object.entries(req.body)) company.limitOverrides[k] = v;
  await company.save();
  audit(req, 'company.limits_updated', { company: company._id, targetType: 'Company', targetId: company._id, meta: req.body });
  res.json({ success: true, data: company.limitOverrides });
}

/* --------------------------------- Plans --------------------------------- */
export async function listPlans(_req, res) {
  const plans = await Plan.find().sort({ isArchived: 1, sortOrder: 1 }).lean();
  const counts = await Subscription.aggregate([{ $group: { _id: '$plan', n: { $sum: 1 } } }]);
  const by = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, data: plans.map((p) => ({ ...p, subscribers: by.get(String(p._id)) || 0 })) });
}

export async function createPlan(req, res) {
  const plan = await Plan.create({ ...req.body, slug: req.body.slug || slugify(req.body.name) });
  audit(req, 'plan.create', { targetType: 'Plan', targetId: plan._id, summary: plan.name });
  res.status(201).json({ success: true, data: plan });
}

export async function updatePlan(req, res) {
  const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!plan) throw ApiError.notFound('Plan not found');
  audit(req, 'plan.update', { targetType: 'Plan', targetId: plan._id, summary: plan.name, meta: req.body });
  res.json({ success: true, data: plan });
}

export async function archivePlan(req, res) {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  plan.isArchived = req.body.archived;
  await plan.save();
  audit(req, plan.isArchived ? 'plan.archive' : 'plan.unarchive', { targetType: 'Plan', targetId: plan._id, summary: plan.name });
  res.json({ success: true, data: plan });
}

/* ------------------------------- Policies -------------------------------- */
export async function getPolicies(_req, res) {
  res.json({ success: true, data: await getPlatformPolicy({ fresh: true }) });
}

export async function updatePolicies(req, res) {
  const $set = {};
  for (const [section, values] of Object.entries(req.body)) {
    for (const [k, v] of Object.entries(values)) $set[`${section}.${k}`] = v;
  }
  $set.updatedBy = req.user._id;
  const doc = await PlatformPolicy.findOneAndUpdate({ key: 'platform' }, { $set }, { new: true, upsert: true, runValidators: true }).lean();
  invalidatePlatformPolicy();
  audit(req, 'policy.update', { targetType: 'PlatformPolicy', summary: `Updated ${Object.keys(req.body).join(', ')}`, meta: req.body });
  res.json({ success: true, data: doc });
}

/* ------------------------------ Audit & leads ----------------------------- */
export async function listAuditLogs(req, res) {
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 50 });
  const filter = {};
  if (req.query.company) filter.company = new mongoose.Types.ObjectId(req.query.company);
  if (req.query.action) filter.action = new RegExp(`^${escapeRegex(req.query.action)}`);
  if (req.query.q) filter.$or = [{ summary: new RegExp(escapeRegex(req.query.q), 'i') }, { actorName: new RegExp(escapeRegex(req.query.q), 'i') }];
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('company', 'name').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}

export async function listLeads(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const filter = req.query.status && req.query.status !== 'all' ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([Lead.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Lead.countDocuments(filter)]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}

export async function updateLead(req, res) {
  const lead = await Lead.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!lead) throw ApiError.notFound('Lead not found');
  res.json({ success: true, data: lead });
}

export async function meta(_req, res) {
  res.json({ success: true, data: { modules: MODULES, resources: RESOURCES, scopes: SCOPES } });
}
