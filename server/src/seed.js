/**
 * Seeds: platform policy, default subscription plans, and the first Super Admin.
 * Optional: `npm run seed -- --demo` also creates a demo company (owner: owner@demo.gosoft.in / Demo@1234).
 * Safe to re-run — existing records are left as they are.
 */
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import fs from 'node:fs';
import { Plan, User, PlatformPolicy, PaymentGateway, SiteContent, BlogCategory, BlogPost, Customer, Product, Employee, Holiday, Department, Company } from './models/index.js';
import { BLOG_CATEGORIES, BLOG_POSTS } from './seed-data/blog.js';
import { slugify } from './utils/slug.js';
import { provisionCompany } from './services/provisioning.js';

const PLANS = [
  {
    name: 'Starter', slug: 'starter', sortOrder: 1, tagline: 'For small teams getting organised',
    priceMonthly: 499, priceAnnual: 4990, trialDays: 14,
    limits: { users: 3, employees: 10, invoicesPerMonth: 100, storageMB: 1024, branches: 1 },
    modules: ['billing', 'hrms', 'tasks'],
    features: ['GST billing & invoices', 'Basic HRMS & attendance', 'Leave management', 'Basic task boards', 'Up to 10 employees', 'Email support'],
  },
  {
    name: 'Growth', slug: 'growth', sortOrder: 2, highlighted: true, tagline: 'Most popular for growing businesses',
    priceMonthly: 1499, priceAnnual: 14990, trialDays: 14,
    limits: { users: 10, employees: 50, invoicesPerMonth: 1000, storageMB: 5120, branches: 1 },
    modules: ['billing', 'hrms', 'payroll', 'tasks', 'reports'],
    features: ['Everything in Starter', 'Payroll with PF / ESI / TDS', 'Advanced billing & credit notes', 'Reports & exports', 'Up to 50 employees', 'Priority email & chat support'],
  },
  {
    name: 'Business', slug: 'business', sortOrder: 3, tagline: 'Advanced HR, payroll and analytics',
    priceMonthly: 3999, priceAnnual: 39990, trialDays: 14,
    limits: { users: 30, employees: 200, invoicesPerMonth: 5000, storageMB: 20480, branches: 3 },
    modules: ['billing', 'hrms', 'payroll', 'tasks', 'reports', 'analytics', 'customRoles'],
    features: ['Everything in Growth', 'Custom roles & permissions', 'Advanced analytics', 'Multiple departments', 'Up to 200 employees', 'Phone support'],
  },
  {
    name: 'Enterprise', slug: 'enterprise', sortOrder: 4, tagline: 'Custom limits, branches & integrations',
    priceMonthly: 9999, priceAnnual: 99990, trialDays: 30,
    limits: { users: -1, employees: -1, invoicesPerMonth: -1, storageMB: 102400, branches: -1 },
    modules: ['billing', 'hrms', 'payroll', 'tasks', 'reports', 'analytics', 'customRoles', 'multiBranch', 'integrations'],
    features: ['Everything in Business', 'Unlimited users & employees', 'Multiple branches', 'Custom integrations & API', 'Advanced security controls', 'Dedicated account manager'],
  },
];

await connectDB();

if (!(await PlatformPolicy.exists({ key: 'platform' }))) {
  await PlatformPolicy.create({ key: 'platform' });
  console.log('[seed] platform policy created');
}

for (const p of PLANS) {
  if (!(await Plan.exists({ slug: p.slug }))) {
    await Plan.create(p);
    console.log(`[seed] plan ${p.name} created`);
  }
}

if (env.superAdmin.email && env.superAdmin.password) {
  if (!(await User.exists({ email: env.superAdmin.email.toLowerCase() }))) {
    const u = new User({ name: env.superAdmin.name, email: env.superAdmin.email, isSuperAdmin: true, emailVerified: true, status: 'active' });
    await u.setPassword(env.superAdmin.password);
    await u.save();
    console.log(`[seed] super admin ${u.email} created — change the password after first login`);
  }
} else {
  console.warn('[seed] SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping super admin');
}

if (!(await PaymentGateway.exists({ provider: 'cashfree' }))) {
  await PaymentGateway.create({ provider: 'cashfree' });
  console.log('[seed] Cashfree gateway record created — add keys in Super Admin → Payment Gateway');
}

if (!(await SiteContent.exists({ key: 'site' }))) {
  const defaults = JSON.parse(fs.readFileSync(new URL('./seed-data/site.json', import.meta.url), 'utf8'));
  await SiteContent.create({ key: 'site', ...defaults, contact: { phone: '9799289697', whatsapp: '919799289697', email: env.support.email,
    address: 'GoSoft, Near Hyatt Regency, Mansarovar, Jaipur 302020' } });
  console.log('[seed] website content created');
}

if (!(await BlogCategory.exists({}))) {
  const cats = await BlogCategory.insertMany(BLOG_CATEGORIES.map((name) => ({ name, slug: slugify(name) })));
  const byName = new Map(cats.map((c) => [c.name, c._id]));
  await BlogPost.insertMany(BLOG_POSTS.map((p, i) => ({
    ...p, slug: slugify(p.title), category: byName.get(p.category), status: 'published',
    publishAt: new Date(Date.now() - (BLOG_POSTS.length - i) * 3 * 864e5), readingMinutes: Math.max(1, Math.round(p.content.split(/\s+/).length / 200)),
    seo: { title: p.title.slice(0, 70), description: p.excerpt.slice(0, 170) },
  })));
  console.log(`[seed] ${BLOG_POSTS.length} blog posts created`);
}

if (process.argv.includes('--demo') && !(await User.exists({ email: 'owner@demo.gosoft.in' }))) {
  const plan = await Plan.findOne({ slug: 'enterprise' }).lean();
  const demo = await provisionCompany({
    company: { name: 'Demo Traders Pvt Ltd', businessType: 'private_limited', industry: 'Retail', phone: '+91 98765 43210' },
    owner: { name: 'Demo Owner', email: 'owner@demo.gosoft.in', password: 'Demo@1234' },
    plan, trialDays: 30, emailVerified: true,
  });
  const cid = demo.company._id;
  await Company.updateOne({ _id: cid }, { gstin: '08AABCD1234E1Z5', address: { line1: 'Near Hyatt Regency', city: 'Jaipur', state: 'Rajasthan', stateCode: '08', pincode: '302020' } });
  await Customer.insertMany([
    { company: cid, name: 'Shree Balaji Traders', gstin: '08AAKFS1234L1Z2', stateCode: '08', email: 'accounts@balaji.example', billingAddress: { city: 'Jaipur', state: 'Rajasthan' } },
    { company: cid, name: 'Mumbai Retail Co', gstin: '27AAACM1234K1Z9', stateCode: '27', email: 'ap@mumbairetail.example', billingAddress: { city: 'Mumbai', state: 'Maharashtra' } },
  ]);
  await Product.insertMany([
    { company: cid, name: 'Annual Maintenance Contract', type: 'service', hsnSac: '998713', rate: 25000, taxRate: 18, unit: 'NOS' },
    { company: cid, name: 'Office Chair', type: 'goods', hsnSac: '9401', rate: 4500, taxRate: 18, unit: 'NOS' },
    { company: cid, name: 'Printer Paper A4 (500 sheets)', type: 'goods', hsnSac: '4802', rate: 320, taxRate: 12, unit: 'PKT' },
  ]);
  const dept = await Department.findOne({ company: cid, name: 'Management' }).lean();
  await Employee.create({ company: cid, employeeId: 'EMP0001', user: demo.user._id, firstName: 'Demo', lastName: 'Owner', email: 'owner@demo.gosoft.in', department: dept._id,
    designation: 'Director', joiningDate: new Date(Date.now() - 400 * 864e5), salary: { basic: 40000, hra: 16000, allowances: [{ name: 'Special Allowance', amount: 9000 }], tdsMonthly: 3500 } });
  const y = new Date().getFullYear();
  await Holiday.insertMany([['Republic Day', `${y}-01-26`], ['Independence Day', `${y}-08-15`], ['Gandhi Jayanti', `${y}-10-02`]].map(([name, d]) => ({ company: cid, name, date: new Date(d) })));
  console.log('[seed] demo company created — owner@demo.gosoft.in / Demo@1234');
}

await mongoose.disconnect();
console.log('[seed] done');
