import mongoose from 'mongoose';
const { Schema } = mongoose;

export const BlogCategory = mongoose.model('BlogCategory', new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: String,
}, { timestamps: true }));

export const BlogPost = mongoose.model('BlogPost', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String, maxlength: 400 },
  content: { type: String, default: '' },          // Markdown
  coverImage: String,
  category: { type: Schema.Types.ObjectId, ref: 'BlogCategory' },
  tags: [String],
  author: { name: { type: String, default: 'GO SOFT Team' }, bio: String },
  status: { type: String, enum: ['draft', 'published', 'scheduled'], default: 'draft', index: true },
  publishAt: { type: Date, index: true },
  seo: { title: String, description: String, canonical: String },
  readingMinutes: Number,
  views: { type: Number, default: 0 },
}, { timestamps: true }).index({ title: 'text', excerpt: 'text', content: 'text' }));

/** Singleton holding all editable public-site content. Nothing marketing-related is hardcoded. */
export const SiteContent = mongoose.model('SiteContent', new Schema({
  key: { type: String, default: 'site', unique: true },
  brand: { logoUrl: String, faviconUrl: String, tagline: { type: String, default: 'Business Simplified. Growth Amplified.' } },
  hero: {
    headline: { type: String, default: 'One Platform. Complete Business Control.' },
    subheadline: { type: String, default: "Manage billing, employees, payroll, attendance and tasks with GO SOFT — India's next-generation business management software." },
    badge: { type: String, default: "India's Next-Generation Business Management Platform" },
  },
  announcement: { enabled: { type: Boolean, default: false }, text: String, link: String },
  contact: {
    phone: { type: String, default: '9799289697' },
    whatsapp: { type: String, default: '919799289697' },
    email: { type: String, default: 'support@gosoft.in' },
    address: { type: String, default: 'GoSoft, Near Hyatt Regency, Mansarovar, Jaipur 302020' },
    hours: { type: String, default: 'Mon–Sat, 10:00 AM – 7:00 PM IST' },
  },
  social: { facebook: String, instagram: String, linkedin: String, twitter: String, youtube: String },
  testimonials: [{ name: String, role: String, company: String, quote: String, photoUrl: String }],
  faqs: [{ q: String, a: String }],
  features: [{ title: String, description: String }],
  landingPages: [{ slug: String, name: String, short: String, title: String, h1: String, intro: String, points: [String], seoDescription: String }],
  footer: { about: String, copyright: String },
  seo: {
    defaultTitle: { type: String, default: 'GO SOFT — Billing, HRMS, Payroll & Task Management Software' },
    defaultDescription: String, ogImage: String,
    googleSiteVerification: String,
  },
  sitemap: { includeBlog: { type: Boolean, default: true }, extraUrls: [String] },
  redirects: [{ from: String, to: String, permanent: { type: Boolean, default: true } }],
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));
