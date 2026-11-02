import { User, Role, Company, Plan, AuditLog, RefreshToken } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate, pageMeta, escapeRegex } from '../utils/pagination.js';
import { randomToken, hashToken } from '../utils/tokens.js';
import { slugify } from '../utils/slug.js';
import { isValidGstin } from '../policy/gstin.js';
import { MODULES, RESOURCES, SCOPES, SCOPE_RANK, isValidPermissionKey } from '../policy/permissions.js';
import { resolvePermission, effectiveLimit } from '../policy/engine.js';
import { audit } from '../services/audit.js';
import { mails } from '../services/mailer.js';
import { env } from '../config/env.js';

const tenant = (req) => ({ company: req.tenantId });
export const countSeats = (req) => User.countDocuments({ company: req.tenantId, deletedAt: null, status: { $ne: 'inactive' } });
const isOwner = (req) => req.ctx.role?.slug === 'company-owner';

/* ------------------------------- Dashboard ------------------------------- */
export async function dashboard(req, res) {
  const { company, plan } = req.ctx;
  const [byStatus, roles, recent] = await Promise.all([
    User.aggregate([{ $match: { company: company._id, deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Role.countDocuments(tenant(req)),
    resolvePermission(req.ctx.role, 'core.audit.view')
      ? AuditLog.find({ company: company._id }).sort({ createdAt: -1 }).limit(8).select('action summary actorName createdAt').lean()
      : [],
  ]);
  const users = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
  const seats = (users.active || 0) + (users.invited || 0);
  res.json({
    success: true,
    data: {
      users: { active: users.active || 0, invited: users.invited || 0, inactive: users.inactive || 0 },
      roles,
      usage: {
        users: { used: seats, limit: effectiveLimit('users', plan, company) },
        employees: { used: 0, limit: effectiveLimit('employees', plan, company) },
        invoicesPerMonth: { used: 0, limit: effectiveLimit('invoicesPerMonth', plan, company) },
        storageMB: { used: company.usage?.storageMB || 0, limit: effectiveLimit('storageMB', plan, company) },
      },
      modules: Object.entries(MODULES).map(([key, m]) => ({ key, label: m.label, enabled: !!m.alwaysOn || (plan?.modules || []).includes(key) })),
      subscription: req.subscriptionState,
      recentActivity: recent,
    },
  });
}

/* -------------------------------- Settings ------------------------------- */
export async function getSettings(req, res) {
  const company = await Company.findById(req.tenantId).select('-limitOverrides -suspension -usage -deletedAt').lean();
  res.json({ success: true, data: company });
}

export async function updateSettings(req, res) {
  const b = req.body;
  if (b.gstin && !isValidGstin(b.gstin)) throw ApiError.badRequest('Please enter a valid 15-character GSTIN.');
  const $set = {};
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    if (k === 'settings' || k === 'address') {
      for (const [sk, sv] of Object.entries(v)) if (sv !== undefined) $set[`${k}.${sk}`] = sv;
    } else $set[k] = v;
  }
  const company = await Company.findByIdAndUpdate(req.tenantId, { $set }, { new: true, runValidators: true })
    .select('-limitOverrides -suspension -usage -deletedAt');
  audit(req, 'company.settings_updated', { targetType: 'Company', targetId: req.tenantId, meta: b });
  res.json({ success: true, data: company });
}

/* ---------------------------------- Users -------------------------------- */
function scopeFilter(req) {
  const f = { company: req.tenantId, deletedAt: null };
  if (req.scope === 'own') f._id = req.user._id;
  else if (req.scope === 'team' || req.scope === 'assigned') f.$or = [{ manager: req.user._id }, { _id: req.user._id }];
  return f;
}

export async function listUsers(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const filter = scopeFilter(req);
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$and = [{ $or: [{ name: rx }, { email: rx }, { designation: rx }, { department: rx }] }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit)
      .select('name email phone status designation department role manager lastLoginAt emailVerified createdAt')
      .populate({ path: 'role', select: 'name slug', match: { company: req.tenantId } }).populate('manager', 'name').lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}

async function assertAssignableRole(req, roleId) {
  const role = await Role.findOne({ _id: roleId, company: req.tenantId }).lean();
  if (!role) throw ApiError.badRequest('Role not found in this company');
  if (role.slug === 'company-owner' && !isOwner(req)) throw ApiError.forbidden('Only the Company Owner can assign the owner role.');
  return role;
}

async function assertManager(req, managerId) {
  if (!managerId) return;
  if (!(await User.exists({ _id: managerId, company: req.tenantId, deletedAt: null }))) throw ApiError.badRequest('Reporting manager not found');
}

export async function createUser(req, res) {
  const b = req.body;
  await assertAssignableRole(req, b.role);
  await assertManager(req, b.manager);
  if (await User.exists({ email: b.email })) throw ApiError.conflict('A user with this email already exists on GO SOFT.');

  const token = randomToken(24);
  const user = await User.create({
    company: req.tenantId, name: b.name, email: b.email, phone: b.phone, role: b.role, manager: b.manager || null,
    designation: b.designation, department: b.department, status: 'invited',
    passwordResetTokenHash: hashToken(token), passwordResetExpires: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });
  if (req.linkEmployee) { req.linkEmployee.user = user._id; await req.linkEmployee.save(); }
  await mails.invite(user.email, user.name, req.ctx.company.name, `${env.appUrl}/accept-invite?token=${token}`);
  audit(req, 'user.invite', { targetType: 'User', targetId: user._id, summary: `Invited ${user.email}` });
  res.status(201).json({ success: true, data: user.toSafeJSON() });
}

async function loadTenantUser(req) {
  const user = await User.findOne({ ...scopeFilter(req), _id: req.params.id });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

const ownerGuard = async (req, user) => {
  const role = await Role.findOne({ _id: user.role, company: req.tenantId }).lean();
  if (role?.slug === 'company-owner' && !isOwner(req)) throw ApiError.forbidden('Only the Company Owner can change the owner account.');
  return role;
};

export async function updateUser(req, res) {
  const user = await loadTenantUser(req);
  await ownerGuard(req, user);
  const b = req.body;
  if (b.role) {
    if (String(user._id) === String(req.user._id)) throw ApiError.forbidden('You cannot change your own role.');
    await assertAssignableRole(req, b.role);
  }
  if (b.manager !== undefined) {
    if (b.manager && String(b.manager) === String(user._id)) throw ApiError.badRequest('A user cannot report to themselves.');
    await assertManager(req, b.manager);
  }
  Object.assign(user, b);
  await user.save();
  audit(req, 'user.update', { targetType: 'User', targetId: user._id, summary: user.email, meta: b });
  res.json({ success: true, data: user.toSafeJSON() });
}

export async function setUserStatus(req, res) {
  const user = await loadTenantUser(req);
  if (String(user._id) === String(req.user._id)) throw ApiError.forbidden('You cannot change your own status.');
  const role = await ownerGuard(req, user);
  if (role?.slug === 'company-owner') throw ApiError.forbidden('The Company Owner account cannot be deactivated.');
  const { status } = req.body;
  if (status === 'active' && user.status === 'inactive') {
    // Reactivating consumes a seat again.
    const max = effectiveLimit('users', req.ctx.plan, req.ctx.company);
    if (max !== -1 && (await countSeats(req)) + 1 > max) throw ApiError.forbidden(`Your plan allows up to ${max} users. Upgrade to add more.`, 'LIMIT_REACHED');
  }
  user.status = status;
  user.tokenVersion += 1;
  await user.save();
  if (status === 'inactive') await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  audit(req, status === 'inactive' ? 'user.deactivate' : 'user.activate', { targetType: 'User', targetId: user._id, summary: user.email });
  res.json({ success: true, data: user.toSafeJSON() });
}

export async function deleteUser(req, res) {
  const user = await loadTenantUser(req);
  if (String(user._id) === String(req.user._id)) throw ApiError.forbidden('You cannot delete your own account here.');
  const role = await ownerGuard(req, user);
  if (role?.slug === 'company-owner') throw ApiError.forbidden('The Company Owner account cannot be deleted.');
  user.deletedAt = new Date();
  user.status = 'inactive';
  user.email = `deleted+${user._id}+${user.email}`; // frees the email for future use
  user.tokenVersion += 1;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  audit(req, 'user.delete', { targetType: 'User', targetId: user._id });
  res.json({ success: true });
}

export async function resendInvite(req, res) {
  const user = await loadTenantUser(req);
  if (user.status !== 'invited') throw ApiError.badRequest('This user has already accepted the invitation.');
  const token = randomToken(24);
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await user.save();
  await mails.invite(user.email, user.name, req.ctx.company.name, `${env.appUrl}/accept-invite?token=${token}`);
  res.json({ success: true });
}

/* ---------------------------------- Roles -------------------------------- */
export async function permissionCatalog(req, res) {
  const tenantScopes = SCOPES.filter((s) => s !== 'platform');
  res.json({ success: true, data: { modules: MODULES, resources: RESOURCES, scopes: tenantScopes, planModules: req.ctx.plan?.modules || [] } });
}

export async function listRoles(req, res) {
  const roles = await Role.find(tenant(req)).sort({ isSystem: -1, createdAt: 1 }).lean();
  const counts = await User.aggregate([{ $match: { company: req.tenantId, deletedAt: null } }, { $group: { _id: '$role', n: { $sum: 1 } } }]);
  const by = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, data: roles.map((r) => ({ ...r, users: by.get(String(r._id)) || 0 })) });
}

/** Validates keys and prevents privilege escalation: you can only grant what you hold, at most at your scope. */
function sanitizePermissions(req, permissions) {
  const seen = new Map();
  for (const p of permissions) {
    if (p.key === '*' || !isValidPermissionKey(p.key)) throw ApiError.badRequest(`Unknown permission: ${p.key}`);
    if (p.scope === 'platform') throw ApiError.badRequest('Platform scope cannot be granted to company roles.');
    const mine = resolvePermission(req.ctx.role, p.key);
    if (!mine) throw ApiError.forbidden(`You cannot grant a permission you do not have: ${p.key}`, 'ESCALATION_DENIED');
    if (SCOPE_RANK[p.scope] > SCOPE_RANK[mine]) throw ApiError.forbidden(`You cannot grant ${p.key} at a wider scope than your own.`, 'ESCALATION_DENIED');
    const prev = seen.get(p.key);
    if (!prev || SCOPE_RANK[p.scope] > SCOPE_RANK[prev]) seen.set(p.key, p.scope);
  }
  return [...seen].map(([key, scope]) => ({ key, scope }));
}

export async function createRole(req, res) {
  const permissions = sanitizePermissions(req, req.body.permissions);
  let slug = slugify(req.body.name);
  if (await Role.exists({ company: req.tenantId, slug })) slug = `${slug}-${randomToken(2)}`;
  const role = await Role.create({ company: req.tenantId, name: req.body.name, description: req.body.description, slug, permissions });
  audit(req, 'role.create', { targetType: 'Role', targetId: role._id, summary: role.name });
  res.status(201).json({ success: true, data: role });
}

export async function updateRole(req, res) {
  const role = await Role.findOne({ _id: req.params.id, company: req.tenantId });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.locked) throw ApiError.forbidden('This role is locked and cannot be modified.');
  if (String(role._id) === String(req.ctx.role?._id) && !isOwner(req)) throw ApiError.forbidden('You cannot edit your own role.');
  if (req.body.name) role.name = req.body.name;
  if (req.body.description !== undefined) role.description = req.body.description;
  if (req.body.permissions) role.permissions = sanitizePermissions(req, req.body.permissions);
  await role.save();
  // Roles are re-read on every request (loadTenant), so changes apply immediately to all holders.
  audit(req, 'role.update', { targetType: 'Role', targetId: role._id, summary: role.name });
  res.json({ success: true, data: role });
}

export async function deleteRole(req, res) {
  const role = await Role.findOne({ _id: req.params.id, company: req.tenantId });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.locked) throw ApiError.forbidden('This role is locked and cannot be deleted.');
  const users = await User.countDocuments({ company: req.tenantId, role: role._id, deletedAt: null });
  if (users) throw ApiError.conflict(`Reassign the ${users} user(s) on this role before deleting it.`);
  await role.softDelete();
  audit(req, 'role.delete', { targetType: 'Role', targetId: role._id, summary: role.name });
  res.json({ success: true });
}

/* ------------------------------ Subscription ----------------------------- */
export async function getSubscription(req, res) {
  const { subscription, plan, company } = req.ctx;
  const plans = await Plan.find({ isArchived: false, isPublic: true }).sort({ sortOrder: 1 }).lean();
  res.json({
    success: true,
    data: {
      subscription: subscription && { status: subscription.status, billingCycle: subscription.billingCycle, trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, history: subscription.history?.slice(-20).reverse() },
      effective: req.subscriptionState,
      plan,
      limits: Object.fromEntries(['users', 'employees', 'invoicesPerMonth', 'storageMB', 'branches'].map((n) => [n, effectiveLimit(n, plan, company)])),
      seatsUsed: await countSeats(req),
      plans,
      checkoutAvailable: false, // Cashfree checkout ships in Phase 2
    },
  });
}

/* ------------------------------- Audit logs ------------------------------ */
export async function listAuditLogs(req, res) {
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 50 });
  const filter = { company: req.tenantId };
  if (req.query.action) filter.action = new RegExp(`^${escapeRegex(req.query.action)}`);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-company').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}
