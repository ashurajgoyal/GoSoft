import { z } from 'zod';
import { email, phone, optionalStr, businessTypes } from './common.js';

export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required').max(120),
  businessType: z.enum(businessTypes).default('proprietorship'),
  industry: optionalStr(80),
  gstin: z.string().trim().toUpperCase().max(15).optional().or(z.literal('').transform(() => undefined)),
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  name: z.string().trim().min(2, 'Your name is required').max(100),
  email,
  password: z.string().min(1, 'Password is required').max(128),
  planSlug: optionalStr(60),
  inviteCode: optionalStr(60),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms and Privacy Policy' }) }),
});

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const tokenSchema = z.object({ token: z.string().min(10).max(200) });
export const emailOnlySchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(128) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) });
export const profileSchema = z.object({ name: z.string().trim().min(2).max(100).optional(), phone: phone.optional() }).strict();
