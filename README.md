# GO SOFT
**Business Simplified. Growth Amplified.** · Powered by Goyals Group

A multi-tenant SaaS for Indian businesses: billing, HRMS, payroll, attendance, tasks and subscriptions, built on the MERN stack.

This repository contains **all six phases** of the roadmap:

| Phase | Scope | Status |
|---|---|---|
| 1 | Brand website, authentication, company registration, multi-tenant architecture, Super Admin, RBAC, admin policy engine | ✅ |
| 2 | Cashfree checkout (managed from Super Admin), subscriptions, coupons, GST tax invoices, refunds, webhooks, Billing & GST module | ✅ |
| 3 | HRMS: employees, departments, attendance (check-in/out, breaks, late, overtime, corrections), leave, holidays, payroll (PF/ESI/PT/TDS), payslips | ✅ |
| 4 | Tasks & projects (Kanban, list, calendar, timeline), employee self-service portal, HR and accountant views via roles | ✅ |
| 5 | Blog CMS, website CMS, SEO landing pages, sitemap/robots, in-app + email notifications, analytics | ✅ |
| 6 | Unit tests, security hardening, Docker/Nginx deployment, documentation | ✅ (load/penetration testing is done on your live server, see docs/DEPLOYMENT.md) |

---

## Modules

**Billing & GST**
- Customers (with ledgers), products and services with HSN/SAC codes, vendors and expenses.
- Tax invoices, proforma invoices, credit notes and debit notes. Numbering resets each financial year, e.g. INV/2026-27/0001.
- GST is calculated automatically: CGST + SGST within your state, IGST for other states. Supports tax-inclusive and tax-exclusive pricing.
- Payment receipts, part-payments and an outstanding/overdue list.
- Sales, GST (rate-wise) and expense reports. Invoices print or save as PDF. Exports open in Excel (CSV).

**HRMS**
- Employee master with bank and PAN details encrypted. Salary and bank fields are visible only to payroll roles.
- Departments, holiday calendar, and leave types with balances.
- Attendance: check in/out, breaks, late marks, overtime, half days, and correction requests that the manager approves.
- Leave requests with manager approval, plus employee requests (letters, salary advance, reimbursement).

**Payroll**
- Salary structure per employee. PF, ESI, PT and TDS rates are configurable.
- Loss-of-pay comes from unpaid leave, and overtime from attendance.
- Payslip adjustments (bonus, incentive, advance recovery). Approve → employees are notified → mark as paid.
- Bank transfer CSV and printable payslips.

**Tasks & projects**
- Projects with a manager, members, deadline and automatic progress.
- Tasks with assignees, an approver, checklists, comments, reminders and history.
- Kanban (drag and drop), list, calendar and timeline views.

**Employee portal (My Workspace)**
- Check in/out, leave balances and applications, payslips and salary history, my tasks, announcements, holidays and requests.

**Payments (Cashfree)**
- Super Admin enters the sandbox and production keys in the panel. Keys are encrypted, never shown again, and there is a test-connection button.
- Super Admin can switch between sandbox and live and turn payments on or off.
- Companies pay from Subscription → plan → Cashfree checkout (UPI, cards, net banking).
- Activation is idempotent. The order is always re-checked with the Cashfree API, the webhook signature is verified, and the amount is checked against the order.
- A GST tax invoice is generated automatically.
- Coupons, renewals and upgrades, cancel at period end, refunds, webhook logs, and an expiry reminder email.

**Website & SEO**
- Website CMS: hero, announcement bar, contact, social links, testimonials, FAQs, the 8 landing pages, SEO defaults, Search Console verification, sitemap settings, 301 redirects, logo/favicon and footer.
- Blog CMS: Markdown editor, drafts, scheduled posts, categories, tags, SEO fields and related posts. 8 original starter articles are included.
- Dynamic sitemap.xml and robots.txt.

**Notifications**
- In-app bell, plus emails for leave and payslips, task assignment, reminders and overdue tasks, approvals, payments and expiry.

---

## Quick start

Requirements: Node 20+ and MongoDB 6+ (local or Atlas).

```bash
# 1. MongoDB (or use Atlas and skip this)
docker compose up -d

# 2. API
cd server
cp .env.example .env          # edit secrets, SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD
npm install
npm run seed -- --demo        # plans, platform policy, super admin, demo company
npm run dev                   # http://localhost:5000

# 3. Web app (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Log in at `http://localhost:5173/login`:

| Account | Email | Password |
|---|---|---|
| Super Admin | value of `SUPERADMIN_EMAIL` | value of `SUPERADMIN_PASSWORD` |
| Demo company owner | `owner@demo.gosoft.in` | `Demo@1234` |

Without SMTP settings, emails (verification, invitations, password reset) are **printed in the API console** with their links, so you can test every flow locally.

Run the unit tests (policy engine, GST, payroll, attendance, webhook signature, CSV) with `cd server && npm test`: 22 tests.

### Turning on payments
1. Log in as Super Admin → **Payment Gateway**.
2. Paste the Cashfree **Sandbox** App ID and Secret Key (from the Cashfree Merchant Dashboard → Developers → API Keys) → **Save** → **Test connection**.
3. Turn on **Online payments**. Log in as a company owner → **Subscription** → choose a plan → pay with a Cashfree test card or UPI.
4. To go live, add the **Production** keys, switch the mode to *Production*, and add the webhook URL shown on that page in your Cashfree dashboard.

Locally, plans activate when the browser returns from Cashfree: the API re-checks the order with Cashfree. Webhooks need a public HTTPS URL, which you get once the app is deployed.

---

## Project structure

```
server/src
  config/        env + MongoDB connection
  models/        Mongoose schemas (+ plugins/tenantScoped.js — tenant isolation guard)
  policy/        permissions catalog, policy engine, subscription state, GSTIN & password rules
  middleware/    authenticate, requireSuperAdmin, loadTenant + guard(), validate (Zod), security, errors
  controllers/   auth, admin (Super Admin), company (Company Admin)
  routes/        /auth  /admin (+ gateway, payments, CMS)  /company (+ billing, hr, payroll, work)  /public  /webhooks  sitemap
  services/      provisioning, sessions, platform policy cache, audit log, mailer
  validators/    Zod request schemas
  seed.js        plans, policy, super admin, demo company
server/test      node:test unit tests for the policy layer

client/src
  layouts/       MarketingLayout, AuthLayout, AppLayout (sidebar, banners, blocking screens)
  pages/         marketing/, auth/, admin/, company/
  components/    UI kit, Logo, SEO
  lib/           API client (auto-refresh), query hooks, permission helpers, formatters
  store/         auth (in-memory access token), theme
docs/            API.md, ADMIN-GUIDE.md, DEPLOYMENT.md
```

## Adding a new module

1. Its permission keys already exist in `server/src/policy/permissions.js`. Add a resource there only if you need a new one.
2. Create tenant models with `schema.plugin(tenantScoped)`.
3. Mount routes behind `authenticate, loadTenant`, and give every endpoint a `guard({ permission, write, limit })`.
4. Build every query from `req.tenantId`, narrowed further by `req.scope` (own, team or company).
5. Add pages under `client/src/pages/` (simple resources can use `components/ResourcePage.jsx`) and register them in `App.jsx` and the sidebar in `layouts/AppLayout.jsx`.

See `docs/` for the API reference, admin guide and deployment notes.
