import { User, Company, RefreshToken } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { randomToken, hashToken } from '../utils/tokens.js';
import { validatePassword } from '../policy/password.js';
import { isValidGstin } from '../policy/gstin.js';
import { getPlatformPolicy } from '../services/platformPolicy.js';
import { provisionCompany, resolveTrialPlan } from '../services/provisioning.js';
import { issueSession, clearSessionCookie, REFRESH_COOKIE } from '../services/session.js';
import { buildSessionPayload } from '../services/context.js';
import { audit } from '../services/audit.js';
import { mails } from '../services/mailer.js';
import { env } from '../config/env.js';

const MIN = 60 * 1000;
const emailDomain = (email) => email.split('@')[1]?.toLowerCase();

async function sendVerification(user) {
  const token = randomToken(24);
  user.emailVerifyTokenHash = hashToken(token);
  user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * MIN);
  await user.save();
  await mails.verifyEmail(user.email, user.name, `${env.appUrl}/verify-email?token=${token}`);
}

export async function register(req, res) {
  const b = req.body;
  const platform = await getPlatformPolicy();
  const reg = platform.registration || {};

  if (platform.maintenance?.enabled) throw new ApiError(503, platform.maintenance.message, 'MAINTENANCE');

  // Registration mode
  if (reg.mode === 'invite' && !(reg.inviteCodes || []).includes(b.inviteCode)) {
    throw ApiError.forbidden('Registration is by invitation only. Please enter a valid invite code.', 'INVITE_REQUIRED');
  }

  // Domain rules
  const domain = emailDomain(b.email);
  if ((reg.blockedDomains || []).includes(domain)) throw ApiError.badRequest('Please register with a business or personal email address.');
  if (reg.allowedDomains?.length && !reg.allowedDomains.includes(domain)) {
    throw ApiError.forbidden('Registration is restricted to approved email domains.', 'DOMAIN_NOT_ALLOWED');
  }

  // Daily registration cap
  const since = new Date(Date.now() - 24 * 60 * MIN);
  if (reg.maxRegistrationsPerDay && (await Company.countDocuments({ createdAt: { $gte: since } })) >= reg.maxRegistrationsPerDay) {
    throw new ApiError(429, 'Registrations are temporarily paused. Please try again later.', 'REGISTRATION_LIMIT');
  }

  // Phone & GSTIN rules
  if (reg.phoneRequired && !b.phone) throw ApiError.badRequest('Phone number is required.');
  const gstRule = (reg.gstinRule && (reg.gstinRule[b.businessType] || reg.gstinRule.get?.(b.businessType))) || reg.gstinDefault || 'optional';
  if (gstRule === 'required' && !b.gstin) throw ApiError.badRequest('GSTIN is required for your business type.');
  if (b.gstin && !isValidGstin(b.gstin)) throw ApiError.badRequest('Please enter a valid 15-character GSTIN.');

  const pwError = validatePassword(b.password, platform.password);
  if (pwError) throw ApiError.badRequest(pwError);

  if (await User.exists({ email: b.email })) throw ApiError.conflict('An account with this email already exists.');

  // Trial
  let plan = null;
  let trialDays;
  if (platform.trial?.enabled !== false) {
    if (platform.trial?.oneTrialPerEmailDomain && !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(domain)
      && (await Company.exists({ email: new RegExp(`@${domain.replace('.', '\\.')}$`, 'i') }))) {
      throw ApiError.conflict('A free trial has already been used for this organisation. Please contact sales.');
    }
    plan = await resolveTrialPlan(b.planSlug, platform);
    trialDays = plan?.trialDays || platform.trial?.days;
  }

  const verificationRequired = reg.emailVerificationRequired !== false;
  const { company, user } = await provisionCompany({
    company: { name: b.companyName, businessType: b.businessType, industry: b.industry, phone: b.phone, gstin: b.gstin },
    owner: { name: b.name, email: b.email, password: b.password },
    plan, trialDays,
    status: reg.mode === 'approval' ? 'pending' : 'active',
    emailVerified: !verificationRequired,
  });

  audit(req, 'company.register', { actor: user, company: company._id, targetType: 'Company', targetId: company._id, summary: `${company.name} registered` });

  if (verificationRequired) {
    const fullUser = await User.findById(user._id);
    await sendVerification(fullUser);
    return res.status(201).json({ success: true, data: { requiresVerification: true, pendingApproval: company.status === 'pending', email: user.email } });
  }

  const { accessToken } = await issueSession(req, res, user, platform);
  res.status(201).json({ success: true, data: { accessToken, pendingApproval: company.status === 'pending', session: await buildSessionPayload(user.toObject()) } });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const platform = await getPlatformPolicy();
  const s = platform.session || {};
  const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash +failedLogins +lockUntil');
  const generic = new ApiError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS');
  if (!user) throw generic;

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new ApiError(423, 'Too many failed attempts. Your account is temporarily locked — try again later or reset your password.', 'ACCOUNT_LOCKED');
  }

  if (!(await user.checkPassword(password))) {
    user.failedLogins = (user.failedLogins || 0) + 1;
    if (user.failedLogins >= (s.maxFailedLogins ?? 5)) {
      user.lockUntil = new Date(Date.now() + (s.lockMinutes ?? 15) * MIN);
      user.failedLogins = 0;
      audit(req, 'auth.locked', { actor: user, company: user.company, targetType: 'User', targetId: user._id });
    }
    await user.save();
    throw generic;
  }

  if (user.status !== 'active') throw ApiError.forbidden('Your account has been deactivated. Contact your administrator.', 'ACCOUNT_INACTIVE');
  if (!user.isSuperAdmin && platform.registration?.emailVerificationRequired !== false && !user.emailVerified) {
    throw ApiError.forbidden('Please verify your email address before logging in.', 'EMAIL_NOT_VERIFIED');
  }
  if (!user.isSuperAdmin && platform.maintenance?.enabled) throw new ApiError(503, platform.maintenance.message, 'MAINTENANCE');

  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  if (user.company) Company.updateOne({ _id: user.company }, { lastActivityAt: new Date() }).catch(() => {});

  const { accessToken } = await issueSession(req, res, user, platform);
  audit(req, 'auth.login', { actor: user, company: user.company });
  res.json({ success: true, data: { accessToken, session: await buildSessionPayload(user.toObject()) } });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No session');
  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!record || record.expiresAt < new Date()) { clearSessionCookie(res); throw ApiError.unauthorized('Session expired'); }

  if (record.revokedAt) {
    // A rotated token was replayed → possible theft. Kill the entire family.
    await RefreshToken.updateMany({ family: record.family, revokedAt: null }, { revokedAt: new Date() });
    clearSessionCookie(res);
    throw new ApiError(401, 'Session invalidated for security reasons. Please log in again.', 'TOKEN_REUSE');
  }

  const user = await User.findById(record.user);
  if (!user || user.deletedAt || user.status !== 'active') { clearSessionCookie(res); throw ApiError.unauthorized('Account unavailable'); }

  const platform = await getPlatformPolicy();
  const { accessToken, refresh: next } = await issueSession(req, res, user, platform, record.family);
  record.revokedAt = new Date();
  record.replacedBy = hashToken(next);
  await record.save();
  res.json({ success: true, data: { accessToken, session: await buildSessionPayload(user.toObject()) } });
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await RefreshToken.updateOne({ tokenHash: hashToken(token) }, { revokedAt: new Date() });
  clearSessionCookie(res);
  res.json({ success: true });
}

export async function logoutAll(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  await RefreshToken.updateMany({ user: req.user._id, revokedAt: null }, { revokedAt: new Date() });
  clearSessionCookie(res);
  audit(req, 'auth.logout_all', { company: req.user.company });
  res.json({ success: true });
}

export async function me(req, res) {
  res.json({ success: true, data: await buildSessionPayload(req.user) });
}

export async function verifyEmail(req, res) {
  const user = await User.findOne({ emailVerifyTokenHash: hashToken(req.body.token), emailVerifyExpires: { $gt: new Date() } })
    .select('+emailVerifyTokenHash +emailVerifyExpires');
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired.');
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  audit(req, 'auth.email_verified', { actor: user, company: user.company });
  res.json({ success: true, data: { message: 'Email verified. You can now log in.' } });
}

export async function resendVerification(req, res) {
  const user = await User.findOne({ email: req.body.email, emailVerified: false });
  if (user) await sendVerification(user);
  res.json({ success: true, data: { message: 'If the account exists and is unverified, a new link has been sent.' } });
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email, deletedAt: null, status: { $ne: 'inactive' } });
  if (user) {
    const token = randomToken(24);
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 30 * MIN);
    await user.save();
    await mails.resetPassword(user.email, user.name, `${env.appUrl}/reset-password?token=${token}`);
    audit(req, 'auth.password_reset_requested', { actor: user, company: user.company });
  }
  // Same response either way — no account enumeration.
  res.json({ success: true, data: { message: 'If an account exists for that email, a reset link has been sent.' } });
}

/** Used for both password reset and accepting an invitation. */
export async function resetPassword(req, res) {
  const user = await User.findOne({ passwordResetTokenHash: hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } })
    .select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This link is invalid or has expired.');
  const platform = await getPlatformPolicy();
  const pwError = validatePassword(req.body.password, platform.password);
  if (pwError) throw ApiError.badRequest(pwError);

  const wasInvite = user.status === 'invited';
  await user.setPassword(req.body.password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.emailVerified = true; // they proved ownership of the inbox
  if (wasInvite) user.status = 'active';
  user.tokenVersion += 1;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  audit(req, wasInvite ? 'user.invite_accepted' : 'auth.password_reset', { actor: user, company: user.company });
  res.json({ success: true, data: { message: wasInvite ? 'Welcome aboard! You can now log in.' : 'Password updated. Please log in.' } });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await user.checkPassword(req.body.currentPassword))) throw ApiError.badRequest('Current password is incorrect.');
  const platform = await getPlatformPolicy();
  const pwError = validatePassword(req.body.newPassword, platform.password);
  if (pwError) throw ApiError.badRequest(pwError);
  await user.setPassword(req.body.newPassword);
  user.tokenVersion += 1;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  const { accessToken } = await issueSession(req, res, user, platform);
  audit(req, 'auth.password_changed', { company: user.company });
  res.json({ success: true, data: { accessToken } });
}

export async function updateProfile(req, res) {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true });
  res.json({ success: true, data: user.toSafeJSON() });
}
