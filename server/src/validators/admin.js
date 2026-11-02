import { z } from 'zod';
import { objectId } from './common.js';
import { MODULES } from '../policy/permissions.js';

const limit = z.number().int().min(-1).max(1_000_000);

export const statusSchema = z.object({
  action: z.enum(['activate', 'suspend', 'reactivate', 'block']),
  reason: z.string().trim().max(500).optional(),
  category: z.enum(['payment', 'abuse', 'security', 'terms', 'fraud', 'administrative']).optional(),
});

export const trialSchema = z.object({ days: z.number().int().min(1).max(365), note: z.string().max(200).optional() });

export const subscriptionSchema = z.object({
  planId: objectId.optional(),
  status: z.enum(['trialing', 'active', 'past_due', 'cancelled', 'expired']).optional(),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  periodEnd: z.coerce.date().optional(),
  graceDaysOverride: z.number().int().min(0).max(90).nullable().optional(),
  note: z.string().max(200).optional(),
});

export const limitsSchema = z.object({
  users: limit.nullable().optional(), employees: limit.nullable().optional(),
  invoicesPerMonth: limit.nullable().optional(), storageMB: limit.nullable().optional(),
}).strict();

const planBase = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(60).optional(),
  tagline: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  priceMonthly: z.number().min(0).max(10_000_000),
  priceAnnual: z.number().min(0).max(100_000_000),
  trialDays: z.number().int().min(0).max(365).default(14),
  limits: z.object({ users: limit, employees: limit, invoicesPerMonth: limit, storageMB: limit, branches: limit }).partial(),
  modules: z.array(z.enum(Object.keys(MODULES))).default([]),
  features: z.array(z.string().trim().max(120)).max(30).default([]),
  highlighted: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const createPlanSchema = planBase;
export const updatePlanSchema = planBase.partial();
export const archiveSchema = z.object({ archived: z.boolean() });

const bool = z.boolean();
const int = (min, max) => z.number().int().min(min).max(max);
export const policiesSchema = z.object({
  registration: z.object({
    mode: z.enum(['open', 'invite', 'approval']), emailVerificationRequired: bool, phoneRequired: bool,
    businessDetailsRequired: bool, gstinDefault: z.enum(['required', 'optional']),
    gstinRule: z.record(z.enum(['required', 'optional'])),
    allowedDomains: z.array(z.string().trim().toLowerCase().max(100)).max(200),
    blockedDomains: z.array(z.string().trim().toLowerCase().max(100)).max(500),
    maxRegistrationsPerDay: int(0, 100000), inviteCodes: z.array(z.string().trim().max(60)).max(200),
  }).partial(),
  trial: z.object({ enabled: bool, defaultPlanSlug: z.string().max(60), days: int(0, 365), oneTrialPerEmailDomain: bool }).partial(),
  subscription: z.object({ graceDays: int(0, 90), afterGrace: z.enum(['read_only', 'blocked']), allowExportWhenExpired: bool, expiryWarningDays: int(0, 60) }).partial(),
  password: z.object({ minLength: int(6, 64), requireUppercase: bool, requireNumber: bool, requireSymbol: bool }).partial(),
  session: z.object({ accessTokenMinutes: int(5, 120), refreshTokenDays: int(1, 90), maxFailedLogins: int(3, 50), lockMinutes: int(1, 1440) }).partial(),
  rateLimit: z.object({ windowMinutes: int(1, 1440), maxRequests: int(10, 100000), authMaxRequests: int(5, 1000) }).partial(),
  uploads: z.object({ maxFileSizeMB: int(1, 100), allowedTypes: z.array(z.string().max(100)).max(50) }).partial(),
  dataRetention: z.object({ softDeletePurgeDays: int(7, 3650), auditLogRetentionDays: int(90, 3650) }).partial(),
  notifications: z.object({ emailEnabled: bool, whatsappEnabled: bool, smsEnabled: bool }).partial(),
  maintenance: z.object({ enabled: bool, message: z.string().max(300) }).partial(),
}).partial().strict();

export const leadStatusSchema = z.object({ status: z.enum(['new', 'contacted', 'qualified', 'closed']) });
