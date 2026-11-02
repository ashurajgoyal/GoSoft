import { z } from 'zod';
import { email, phone, objectId, optionalStr, businessTypes } from './common.js';
import { SCOPES } from '../policy/permissions.js';

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
  industry: optionalStr(80),
  businessType: z.enum(businessTypes).optional(),
  gstin: z.string().trim().toUpperCase().max(15).optional(),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN').optional().or(z.literal('')),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  address: z.object({
    line1: optionalStr(200), line2: optionalStr(200), city: optionalStr(80), state: optionalStr(80),
    stateCode: optionalStr(2), pincode: z.string().regex(/^\d{6}$/, 'Invalid PIN code').optional().or(z.literal('')), country: optionalStr(60),
  }).partial().optional(),
  settings: z.object({
    currency: z.string().length(3).optional(), timezone: z.string().max(60).optional(),
    financialYearStartMonth: z.number().int().min(1).max(12).optional(), dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  }).optional(),
}).strict();

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  role: objectId,
  manager: objectId.optional().or(z.literal('').transform(() => undefined)),
  designation: optionalStr(80),
  department: optionalStr(80),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: phone.optional().or(z.literal('')),
  role: objectId.optional(),
  manager: objectId.nullable().optional(),
  designation: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
}).strict();

export const userStatusSchema = z.object({ status: z.enum(['active', 'inactive']) });

const permission = z.object({ key: z.string().max(80), scope: z.enum(SCOPES) });
export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional(),
  permissions: z.array(permission).max(300),
});
export const updateRoleSchema = createRoleSchema.partial();
