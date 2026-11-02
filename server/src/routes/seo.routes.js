import { Router } from 'express';
import { BlogPost, SiteContent } from '../models/index.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

/** XML sitemap + robots.txt. Point https://www.gosoft.in/sitemap.xml here (reverse proxy) or submit this URL to Search Console. */
const r = Router();
const STATIC = ['/', '/features', '/pricing', '/about', '/contact', '/book-demo', '/blog', '/register', '/legal/privacy-policy', '/legal/terms', '/legal/refund-policy', '/legal/cancellation-policy'];
const MODULES = ['billing-software-india', 'gst-billing-software', 'hrms-software-india', 'payroll-software-india', 'employee-management-software', 'attendance-software', 'task-management-software', 'business-management-software'];
const xmlEsc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

r.get('/sitemap.xml', h(async (_req, res) => {
  const site = await SiteContent.findOne({ key: 'site' }).lean();
  const base = (process.env.PUBLIC_SITE_URL || env.appUrl).replace(/\/$/, '');
  const urls = [...STATIC.map((p) => ({ loc: p })), ...MODULES.map((m) => ({ loc: `/software/${m}` })), ...(site?.sitemap?.extraUrls || []).map((loc) => ({ loc }))];
  if (site?.sitemap?.includeBlog !== false) {
    const posts = await BlogPost.find({ $or: [{ status: 'published' }, { status: 'scheduled' }], publishAt: { $lte: new Date() } }).select('slug updatedAt').lean();
    urls.push(...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updatedAt })));
  }
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xmlEsc(u.loc.startsWith('http') ? u.loc : base + u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`);
}));

r.get('/robots.txt', (_req, res) => {
  const base = (process.env.PUBLIC_SITE_URL || env.appUrl).replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /app\nSitemap: ${base}/sitemap.xml\n`);
});
export default r;
