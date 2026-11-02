import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, resolvePermission, effectiveLimit } from '../src/policy/engine.js';
import { computeSubscriptionState } from '../src/policy/subscription.js';
import { DEFAULT_ROLE_TEMPLATES, ALL_PERMISSION_KEYS, isValidPermissionKey } from '../src/policy/permissions.js';
import { isValidGstin } from '../src/policy/gstin.js';
import { validatePassword } from '../src/policy/password.js';

const DAY = 864e5;
const now = new Date('2026-11-02T10:00:00Z');
const role = (slug) => DEFAULT_ROLE_TEMPLATES.find((r) => r.slug === slug);
const company = { _id: 'c1', status: 'active', limitOverrides: {} };
const plan = { modules: ['billing', 'hrms', 'tasks'], limits: { users: 3 } };
const activeSub = { status: 'active', currentPeriodEnd: new Date(now.getTime() + 20 * DAY) };
const ctx = (over = {}) => ({
  user: { _id: 'u1', company: 'c1', status: 'active' }, role: role('accountant'), company, plan,
  subscription: activeSub, platform: { subscription: { graceDays: 7, afterGrace: 'read_only' } }, now, ...over,
});

test('default role templates only use valid permission keys', () => {
  for (const t of DEFAULT_ROLE_TEMPLATES) for (const p of t.permissions) assert.ok(isValidPermissionKey(p.key), `${t.slug}: ${p.key}`);
  assert.ok(ALL_PERMISSION_KEYS.length > 50);
});

test('accountant can create invoices when everything is in order', () => {
  const d = evaluate(ctx(), { permission: 'billing.invoice.create', write: true });
  assert.equal(d.allowed, true);
  assert.equal(d.scope, 'company');
});

test('spec example: invoice creation is denied for each documented reason', () => {
  assert.equal(evaluate(ctx({ role: role('employee') }), { permission: 'billing.invoice.create', write: true }).code, 'PERMISSION_DENIED');
  assert.equal(evaluate(ctx({ plan: { modules: ['hrms'] } }), { permission: 'billing.invoice.create', write: true }).code, 'MODULE_NOT_IN_PLAN');
  assert.equal(evaluate(ctx({ plan: { modules: ['billing'], limits: { invoicesPerMonth: 10 } } }),
    { permission: 'billing.invoice.create', write: true, limit: { name: 'invoicesPerMonth', current: 10 } }).code, 'LIMIT_REACHED');
  const suspended = evaluate(ctx({ company: { ...company, status: 'suspended', suspension: { reason: 'Unpaid dues' } } }), { permission: 'billing.invoice.create' });
  assert.equal(suspended.code, 'COMPANY_SUSPENDED');
  assert.equal(suspended.details.reason, 'Unpaid dues');
  assert.equal(evaluate(ctx({ user: { _id: 'u1', company: 'c1', status: 'inactive' } }), { permission: 'billing.invoice.create' }).code, 'ACCOUNT_INACTIVE');
});

test('tenant mismatch is denied', () => {
  assert.equal(evaluate(ctx({ user: { _id: 'u1', company: 'OTHER', status: 'active' } }), {}).code, 'TENANT_MISMATCH');
});

test('super admin cannot act inside a tenant workspace', () => {
  assert.equal(evaluate(ctx({ user: { _id: 'sa', isSuperAdmin: true, status: 'active' } }), {}).code, 'NOT_TENANT_USER');
});

test('owner wildcard grants everything, limits still apply', () => {
  const c = ctx({ role: role('company-owner') });
  assert.equal(evaluate(c, { permission: 'core.subscription.manage', write: true }).allowed, true);
  assert.equal(evaluate(c, { permission: 'core.user.create', write: true, limit: { name: 'users', current: 3 } }).code, 'LIMIT_REACHED');
  assert.equal(evaluate(c, { permission: 'core.user.create', write: true, limit: { name: 'users', current: 2 } }).allowed, true);
});

test('company limit override beats plan limit; -1 = unlimited', () => {
  assert.equal(effectiveLimit('users', plan, { limitOverrides: { users: 10 } }), 10);
  assert.equal(effectiveLimit('users', { limits: { users: -1 } }, {}), -1);
  assert.equal(evaluate(ctx({ role: role('company-owner'), plan: { modules: [], limits: { users: -1 } } }),
    { permission: 'core.user.create', write: true, limit: { name: 'users', current: 9999 } }).allowed, true);
});

test('subscription lifecycle: trial → grace (read-only) → read_only / blocked', () => {
  const trial = { status: 'trialing', trialEndsAt: new Date(now.getTime() + 3 * DAY) };
  const s1 = computeSubscriptionState(trial, {}, now);
  assert.equal(s1.state, 'trialing');
  assert.match(s1.warning, /trial ends in 3/);

  const ended = { status: 'trialing', trialEndsAt: new Date(now.getTime() - 2 * DAY) };
  assert.equal(computeSubscriptionState(ended, { graceDays: 7 }, now).state, 'grace');
  assert.equal(computeSubscriptionState(ended, { graceDays: 1, afterGrace: 'read_only' }, now).state, 'read_only');
  assert.equal(computeSubscriptionState(ended, { graceDays: 1, afterGrace: 'blocked' }, now).state, 'blocked');
  assert.equal(computeSubscriptionState({ ...ended, graceDaysOverride: 30 }, { graceDays: 1 }, now).state, 'grace');
  assert.equal(computeSubscriptionState(null, {}, now).state, 'none');
});

test('expired subscription: reads allowed, writes blocked, renewal route always reachable', () => {
  const expired = { status: 'active', currentPeriodEnd: new Date(now.getTime() - 3 * DAY) };
  const c = ctx({ subscription: expired });
  assert.equal(evaluate(c, { permission: 'billing.invoice.view' }).allowed, true);
  assert.equal(evaluate(c, { permission: 'billing.invoice.create', write: true }).code, 'SUBSCRIPTION_EXPIRED');
  assert.equal(evaluate(c, { permission: 'billing.invoice.export', export: true }).allowed, true);

  const blocked = ctx({ subscription: expired, platform: { subscription: { graceDays: 0, afterGrace: 'blocked' } } });
  assert.equal(evaluate(blocked, { permission: 'billing.invoice.view' }).code, 'SUBSCRIPTION_REQUIRED');
  assert.equal(evaluate({ ...blocked, role: role('company-owner') }, { permission: 'core.subscription.view', subscriptionRoute: true }).allowed, true);

  const noExport = ctx({ subscription: expired, platform: { subscription: { graceDays: 7, allowExportWhenExpired: false } } });
  assert.equal(evaluate(noExport, { permission: 'billing.invoice.export', export: true }).code, 'SUBSCRIPTION_EXPIRED');
});

test('maintenance mode blocks tenant users', () => {
  assert.equal(evaluate(ctx({ platform: { maintenance: { enabled: true, message: 'x' } } }), {}).code, 'MAINTENANCE');
});

test('scope resolution picks the widest granted scope', () => {
  const r = { permissions: [{ key: 'tasks.task.view', scope: 'own' }, { key: 'tasks.task.view', scope: 'team' }] };
  assert.equal(resolvePermission(r, 'tasks.task.view'), 'team');
  assert.equal(evaluate(ctx({ role: r }), { permission: 'tasks.task.view', minScope: 'company' }).code, 'SCOPE_DENIED');
  assert.equal(resolvePermission(role('employee'), 'payroll.payslip.view'), 'own');
});

test('GSTIN checksum validation', () => {
  assert.equal(isValidGstin('27AAPFU0939F1ZV'), true);
  assert.equal(isValidGstin('27AAPFU0939F1ZX'), false);
  assert.equal(isValidGstin('ABC'), false);
});

test('password policy', () => {
  assert.equal(validatePassword('Secure@123'), null);
  assert.match(validatePassword('short'), /at least 8/);
  assert.match(validatePassword('alllowercase1'), /uppercase/);
  assert.match(validatePassword('NoSymbol123', { requireSymbol: true }), /symbol/);
});
