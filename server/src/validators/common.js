import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });
export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(160);
export const phone = z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number');
export const optionalStr = (max = 200) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));
export const businessTypes = ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'opc', 'other'];
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().max(100).optional(),
  status: z.string().trim().max(30).optional(),
  plan: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  company: objectId.optional(),
  sort: z.string().trim().max(30).optional(),
});
