import { Router } from 'express';
import { z } from 'zod';
import { Plan, Lead, BlogPost, BlogCategory, SiteContent } from '../models/index.js';
import { escapeRegex, paginate, pageMeta } from '../utils/pagination.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { publicFormLimiter } from '../middleware/security.js';
import { getPlatformPolicy } from '../services/platformPolicy.js';
import { MODULES } from '../policy/permissions.js';
import { email } from '../validators/common.js';
import { audit } from '../services/audit.js';
import { env } from '../config/env.js';

const r = Router();

r.get('/plans', h(async (_req, res) => {
  const plans = await Plan.find({ isArchived: false, isPublic: true }).sort({ sortOrder: 1 })
    .select('name slug tagline description priceMonthly priceAnnual currency trialDays limits modules features highlighted').lean();
  res.json({ success: true, data: plans, modules: MODULES });
}));

r.get('/config', h(async (_req, res) => {
  const p = await getPlatformPolicy();
  res.json({
    success: true,
    data: {
      registration: {
        mode: p.registration?.mode, phoneRequired: p.registration?.phoneRequired,
        gstinDefault: p.registration?.gstinDefault, gstinRule: p.registration?.gstinRule,
        emailVerificationRequired: p.registration?.emailVerificationRequired,
      },
      trial: { enabled: p.trial?.enabled, days: p.trial?.days },
      password: p.password,
      maintenance: p.maintenance?.enabled ? p.maintenance : null,
      support: env.support,
    },
  });
}));

const leadSchema = z.object({
  type: z.enum(['contact', 'demo']).default('contact'),
  name: z.string().trim().min(2).max(100),
  email,
  phone: z.string().trim().max(20).optional(),
  company: z.string().trim().max(120).optional(),
  employees: z.string().trim().max(20).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(60).optional(),
  website: z.string().max(0).optional(), // honeypot — bots fill this, humans never see it
});

r.post('/leads', publicFormLimiter, validate({ body: leadSchema }), h(async (req, res) => {
  const { website, ...data } = req.body;
  const lead = await Lead.create(data);
  audit(req, 'lead.create', { targetType: 'Lead', targetId: lead._id, summary: `${lead.type}: ${lead.email}` });
  res.status(201).json({ success: true, data: { message: 'Thank you! Our team will get in touch within one business day.' } });
}));

/* ------------------------------ Website content ----------------------------- */
r.get('/site', h(async (_req, res) => {
  const s = (await SiteContent.findOne({ key: 'site' }).select('-updatedBy -__v').lean()) || {};
  res.json({ success: true, data: s });
}));

/* ----------------------------------- Blog ---------------------------------- */
const published = () => ({ $or: [{ status: 'published' }, { status: 'scheduled' }], publishAt: { $lte: new Date() } });
r.get('/blog', h(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, { defaultLimit: 9, maxLimit: 30 });
  const f = published();
  if (req.query.category) {
    const cat = await BlogCategory.findOne({ slug: String(req.query.category) }).lean();
    f.category = cat?._id || null;
  }
  if (req.query.tag) f.tags = String(req.query.tag);
  if (req.query.q) f.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
  const [items, total, categories] = await Promise.all([
    BlogPost.find(f).sort({ publishAt: -1 }).skip(skip).limit(limit).select('title slug excerpt coverImage category tags author publishAt readingMinutes').populate('category', 'name slug').lean(),
    BlogPost.countDocuments(f), BlogCategory.find().sort({ name: 1 }).lean(),
  ]);
  res.json({ success: true, data: items, categories, meta: pageMeta(total, { page, limit }) });
}));
r.get('/blog/:slug', h(async (req, res) => {
  const post = await BlogPost.findOneAndUpdate({ slug: req.params.slug, ...published() }, { $inc: { views: 1 } }, { new: true }).populate('category', 'name slug').lean();
  if (!post) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } });
  const related = await BlogPost.find({ ...published(), _id: { $ne: post._id }, $or: [{ category: post.category?._id }, { tags: { $in: post.tags || [] } }] })
    .sort({ publishAt: -1 }).limit(3).select('title slug excerpt coverImage publishAt readingMinutes').lean();
  res.json({ success: true, data: post, related });
}));

export default r;
