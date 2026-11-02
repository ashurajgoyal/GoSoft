import { Router } from 'express';
import { z } from 'zod';
import { PaymentGateway, Payment, PlatformInvoice, Coupon, WebhookLog, BlogPost, BlogCategory, SiteContent } from '../models/index.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { encrypt } from '../utils/crypto.js';
import { paginate, pageMeta, escapeRegex } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';
import { getCashfreeConfig, testCredentials, createRefund, CASHFREE_API_VERSION } from '../services/cashfree.js';
import { reconcileOrder } from '../services/subscriptionBilling.js';
import { audit } from '../services/audit.js';
import { idParam } from '../validators/common.js';
import { env } from '../config/env.js';

const r = Router();
r.use(authenticate, requireSuperAdmin);

/* ------------------------------ Payment gateway ----------------------------- */
const maskGw = (gw) => {
  const creds = (c = {}) => ({ appId: c.appId || '', secretConfigured: !!c.secretKeyEnc, updatedAt: c.updatedAt });
  return { enabled: gw.enabled, mode: gw.mode, gstRate: gw.gstRate, seller: gw.seller, sandbox: creds(gw.sandbox), production: creds(gw.production),
    lastTestedAt: gw.lastTestedAt, lastTestResult: gw.lastTestResult, apiVersion: CASHFREE_API_VERSION,
    webhookUrl: `${env.apiUrl}/api/v1/webhooks/cashfree`, returnUrl: `${env.appUrl}/app/subscription?order_id={order_id}` };
};
const getGw = async () => (await PaymentGateway.findOne({ provider: 'cashfree' })) || PaymentGateway.create({ provider: 'cashfree' });

r.get('/gateway', h(async (_req, res) => res.json({ success: true, data: maskGw((await getGw()).toObject()) })));

const credsSchema = z.object({ appId: z.string().trim().max(200).optional(), secretKey: z.string().trim().max(500).optional() });
r.patch('/gateway', validate({ body: z.object({
  enabled: z.boolean().optional(), mode: z.enum(['sandbox', 'production']).optional(), gstRate: z.number().min(0).max(28).optional(),
  sandbox: credsSchema.optional(), production: credsSchema.optional(),
  seller: z.object({ legalName: z.string().max(150), gstin: z.string().max(15), stateCode: z.string().max(2), address: z.string().max(300), phone: z.string().max(20), email: z.string().max(150) }).partial().optional(),
}) }), h(async (req, res) => {
  const gw = await getGw();
  const b = req.body;
  for (const mode of ['sandbox', 'production']) {
    if (!b[mode]) continue;
    if (b[mode].appId !== undefined) gw[mode].appId = b[mode].appId;
    if (b[mode].secretKey) gw[mode].secretKeyEnc = encrypt(b[mode].secretKey); // empty = keep existing
    gw[mode].updatedAt = new Date();
  }
  if (b.mode) gw.mode = b.mode;
  if (b.gstRate !== undefined) gw.gstRate = b.gstRate;
  if (b.seller) gw.seller = { ...gw.seller?.toObject?.() ?? gw.seller, ...b.seller };
  if (b.enabled !== undefined) {
    if (b.enabled) {
      const c = gw[gw.mode];
      if (!c?.appId || !c?.secretKeyEnc) throw ApiError.badRequest(`Add ${gw.mode} App ID and Secret Key before enabling payments.`);
    }
    gw.enabled = b.enabled;
  }
  gw.updatedBy = req.user._id;
  await gw.save();
  audit(req, 'gateway.update', { targetType: 'PaymentGateway', summary: `Cashfree ${gw.mode}${gw.enabled ? ' (enabled)' : ' (disabled)'}`,
    meta: { mode: gw.mode, enabled: gw.enabled, sandboxKeyChanged: !!b.sandbox?.secretKey, productionKeyChanged: !!b.production?.secretKey } });
  res.json({ success: true, data: maskGw(gw.toObject()) });
}));

r.post('/gateway/test', h(async (req, res) => {
  const gw = await getGw();
  const cfg = await getCashfreeConfig({ requireEnabled: false });
  const result = await testCredentials(cfg);
  gw.lastTestedAt = new Date();
  gw.lastTestResult = result.ok ? `OK (${cfg.mode})` : result.message;
  await gw.save();
  audit(req, 'gateway.test', { summary: gw.lastTestResult });
  res.json({ success: true, data: { ok: result.ok, message: result.ok ? `Connected to Cashfree ${cfg.mode} successfully.` : result.message } });
}));

/* -------------------------------- Payments --------------------------------- */
r.get('/payments', h(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = {};
  if (req.query.status && req.query.status !== 'all') f.status = String(req.query.status);
  if (req.query.q) f.orderId = new RegExp(escapeRegex(String(req.query.q)), 'i');
  const [items, total, stats] = await Promise.all([
    Payment.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('company', 'name').populate('plan', 'name').select('-paymentSessionId').lean(),
    Payment.countDocuments(f),
    Payment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$total' } } }]),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }), stats });
}));

r.post('/payments/:id/sync', validate({ params: idParam }), h(async (req, res) => {
  const p = await Payment.findById(req.params.id);
  if (!p) throw ApiError.notFound('Payment not found');
  const result = await reconcileOrder(p);
  audit(req, 'payment.sync', { company: p.company, targetType: 'Payment', targetId: p._id, summary: result.status });
  res.json({ success: true, data: { status: result.status } });
}));

r.post('/payments/:id/refund', validate({ params: idParam, body: z.object({ amount: z.number().positive(), note: z.string().max(200).optional() }) }), h(async (req, res) => {
  const p = await Payment.findById(req.params.id);
  if (!p) throw ApiError.notFound('Payment not found');
  if (!['paid', 'partially_refunded'].includes(p.status)) throw ApiError.badRequest('Only paid payments can be refunded.');
  const refunded = p.refunds.reduce((s, x) => s + (x.status !== 'FAILED' ? x.amount : 0), 0);
  if (req.body.amount > p.total - refunded + 0.001) throw ApiError.badRequest(`Maximum refundable amount is ₹${(p.total - refunded).toFixed(2)}.`);
  const cfg = await getCashfreeConfig({ requireEnabled: false });
  const refundId = `RF_${p.orderId}_${p.refunds.length + 1}`.slice(0, 40);
  const out = await createRefund(cfg, p.orderId, { refund_amount: req.body.amount, refund_id: refundId, refund_note: req.body.note || 'GO SOFT refund' });
  p.refunds.push({ refundId, amount: req.body.amount, status: out.refund_status || 'PENDING', note: req.body.note, by: req.user._id });
  p.status = refunded + req.body.amount >= p.total ? 'refunded' : 'partially_refunded';
  await p.save();
  audit(req, 'payment.refund', { company: p.company, targetType: 'Payment', targetId: p._id, summary: `₹${req.body.amount} refunded (${refundId})` });
  res.json({ success: true, data: p });
}));

r.get('/platform-invoices', h(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const [items, total] = await Promise.all([PlatformInvoice.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PlatformInvoice.countDocuments()]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}));
r.get('/platform-invoices/:id', validate({ params: idParam }), h(async (req, res) => {
  const inv = await PlatformInvoice.findById(req.params.id).lean();
  if (!inv) throw ApiError.notFound('Invoice not found');
  res.json({ success: true, data: inv });
}));

r.get('/webhook-logs', h(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 50 });
  const [items, total] = await Promise.all([WebhookLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), WebhookLog.countDocuments()]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}));

/* --------------------------------- Coupons --------------------------------- */
const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Code: 3–30 letters/numbers'), description: z.string().max(200).optional(),
  type: z.enum(['percent', 'flat']), value: z.number().positive(), maxDiscount: z.number().positive().nullable().optional(),
  plans: z.array(z.string().regex(/^[a-f\d]{24}$/i)).optional(), billingCycles: z.array(z.enum(['monthly', 'annual'])).optional(),
  validFrom: z.coerce.date().nullable().optional(), validTo: z.coerce.date().nullable().optional(), maxRedemptions: z.number().int().positive().nullable().optional(),
  oncePerCompany: z.boolean().optional(), active: z.boolean().optional(),
}).refine((c) => c.type !== 'percent' || c.value <= 100, { message: 'Percent discount cannot exceed 100', path: ['value'] });
r.get('/coupons', h(async (_req, res) => res.json({ success: true, data: await Coupon.find().sort({ createdAt: -1 }).lean() })));
r.post('/coupons', validate({ body: couponSchema }), h(async (req, res) => {
  const c = await Coupon.create(req.body);
  audit(req, 'coupon.create', { targetType: 'Coupon', targetId: c._id, summary: c.code });
  res.status(201).json({ success: true, data: c });
}));
r.patch('/coupons/:id', validate({ params: idParam, body: couponSchema.innerType().partial() }), h(async (req, res) => {
  const c = await Coupon.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!c) throw ApiError.notFound('Coupon not found');
  audit(req, 'coupon.update', { targetType: 'Coupon', targetId: c._id, summary: c.code });
  res.json({ success: true, data: c });
}));
r.delete('/coupons/:id', validate({ params: idParam }), h(async (req, res) => {
  await Coupon.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ success: true });
}));

/* ----------------------------------- Blog ----------------------------------- */
const postSchema = z.object({
  title: z.string().trim().min(3).max(200), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(120).optional().or(z.literal('')),
  excerpt: z.string().max(400).optional(), content: z.string().max(200000).optional(), coverImage: z.string().url().max(500).optional().or(z.literal('')),
  category: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable().or(z.literal('').transform(() => null)), tags: z.array(z.string().trim().max(40)).max(20).optional(),
  author: z.object({ name: z.string().max(80), bio: z.string().max(300).optional() }).optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(), publishAt: z.coerce.date().optional().nullable(),
  seo: z.object({ title: z.string().max(70).optional(), description: z.string().max(170).optional(), canonical: z.string().max(300).optional() }).optional(),
});
const prepPost = (b) => {
  const d = { ...b };
  if (!d.slug && d.title) d.slug = slugify(d.title);
  if (d.content !== undefined) d.readingMinutes = Math.max(1, Math.round(d.content.split(/\s+/).length / 200));
  if (d.status === 'published' && !d.publishAt) d.publishAt = new Date();
  if (d.status === 'scheduled' && !d.publishAt) throw ApiError.badRequest('Pick a publish date for scheduled posts.');
  return d;
};
r.get('/blog/posts', h(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = {};
  if (req.query.status && req.query.status !== 'all') f.status = String(req.query.status);
  if (req.query.q) f.title = new RegExp(escapeRegex(String(req.query.q)), 'i');
  const [items, total] = await Promise.all([BlogPost.find(f).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('category', 'name').select('-content').lean(), BlogPost.countDocuments(f)]);
  res.json({ success: true, data: items, meta: pageMeta(total, { page, limit }) });
}));
r.get('/blog/posts/:id', validate({ params: idParam }), h(async (req, res) => {
  const p = await BlogPost.findById(req.params.id).lean();
  if (!p) throw ApiError.notFound('Post not found');
  res.json({ success: true, data: p });
}));
r.post('/blog/posts', validate({ body: postSchema }), h(async (req, res) => {
  const p = await BlogPost.create(prepPost(req.body));
  audit(req, 'blog.create', { targetType: 'BlogPost', targetId: p._id, summary: p.title });
  res.status(201).json({ success: true, data: p });
}));
r.patch('/blog/posts/:id', validate({ params: idParam, body: postSchema.partial() }), h(async (req, res) => {
  const p = await BlogPost.findByIdAndUpdate(req.params.id, { $set: prepPost(req.body) }, { new: true, runValidators: true });
  if (!p) throw ApiError.notFound('Post not found');
  audit(req, 'blog.update', { targetType: 'BlogPost', targetId: p._id, summary: p.title });
  res.json({ success: true, data: p });
}));
r.delete('/blog/posts/:id', validate({ params: idParam }), h(async (req, res) => {
  await BlogPost.findByIdAndDelete(req.params.id);
  audit(req, 'blog.delete', { targetType: 'BlogPost', targetId: req.params.id });
  res.json({ success: true });
}));
r.get('/blog/categories', h(async (_req, res) => res.json({ success: true, data: await BlogCategory.find().sort({ name: 1 }).lean() })));
r.post('/blog/categories', validate({ body: z.object({ name: z.string().trim().min(2).max(60), description: z.string().max(200).optional() }) }), h(async (req, res) => {
  res.status(201).json({ success: true, data: await BlogCategory.create({ ...req.body, slug: slugify(req.body.name) }) });
}));
r.delete('/blog/categories/:id', validate({ params: idParam }), h(async (req, res) => {
  if (await BlogPost.exists({ category: req.params.id })) throw ApiError.conflict('Move posts out of this category first.');
  await BlogCategory.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

/* ------------------------------- Website CMS -------------------------------- */
r.get('/site', h(async (_req, res) => {
  const s = (await SiteContent.findOne({ key: 'site' }).lean()) || (await SiteContent.create({ key: 'site' })).toObject();
  res.json({ success: true, data: s });
}));
const SITE_SECTIONS = ['brand', 'hero', 'announcement', 'contact', 'social', 'testimonials', 'faqs', 'features', 'landingPages', 'footer', 'seo', 'sitemap', 'redirects'];
r.patch('/site', h(async (req, res) => {
  const $set = { updatedBy: req.user._id };
  for (const k of SITE_SECTIONS) if (req.body[k] !== undefined) $set[k] = req.body[k];
  if (Array.isArray($set.redirects)) $set.redirects = $set.redirects.filter((x) => x?.from?.startsWith('/') && x?.to);
  const s = await SiteContent.findOneAndUpdate({ key: 'site' }, { $set }, { new: true, upsert: true, runValidators: true }).lean();
  audit(req, 'site.update', { summary: `Updated ${Object.keys(req.body).filter((k) => SITE_SECTIONS.includes(k)).join(', ')}` });
  res.json({ success: true, data: s });
}));

export default r;
