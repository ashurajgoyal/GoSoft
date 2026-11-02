# GO SOFT — Admin guide

## Super Admin

### First login
Run `npm run seed` with `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` set, log in at `/login`, then **change the password** under *My profile*.

### Companies
- **Approve.** Used when the registration mode is *Admin approval*. New companies wait as `pending` until you approve them.
- **Suspend.** Choose a category (payment, abuse, security, terms, fraud or administrative) and a reason. Users see the reason and your support contact, and their data and audit logs are kept.
- **Block.** Like suspend, but it also signs every user out immediately.
- **Reactivate.** Restores access to a suspended or blocked company.
- **Extend trial.** Adds days to the current trial, or starts a new one.
- **Manage subscription.** Changes the plan, status or period end by hand, for example after a bank transfer. Cashfree automates this in Phase 2.
- **Limit overrides.** Sets custom users, employees, invoices or storage limits for one company. Leave a field blank to use the plan default, or enter `-1` for unlimited.

### Plans
Each plan sets monthly and annual prices (in ₹, before GST), trial days, limits, the modules it includes, and the marketing bullets shown on the pricing page.
- *Archiving* hides a plan from new signups; companies already on it keep it.
- *Hidden* plans stay usable from the admin panel but don't appear on the public pricing page.

Module keys: `billing`, `hrms`, `payroll`, `tasks`, `reports`, `analytics`, `customRoles`, `multiBranch`, `integrations`.

### Platform policies
| Section | Controls |
|---|---|
| Registration | Open / approval / invite-code mode, email verification, phone required, GSTIN required per business type, allowed/blocked email domains, daily cap |
| Trial & subscription | Trial on/off, default trial plan, one trial per domain, grace days, read-only vs blocked after grace, export while expired, warning days |
| Security | Password rules, token lifetimes, failed-login lockout |
| Uploads & data | Max file size, allowed types, purge and audit retention windows |
| Notifications | Email / WhatsApp / SMS switches |
| Maintenance | Locks every company workspace with a message; Super Admins keep access |

Policy changes apply within 30 seconds (the policy is cached in memory for 30 seconds).

### Subscription lifecycle
`trialing` / `active` → *(period ends)* → **grace** (read-only, renew and export allowed) → **read_only** or **blocked**, as policy decides.
Company data is **never** deleted automatically.

### Payment gateway (Cashfree)
*Super Admin → Payment Gateway*
1. **Sandbox first.** Paste the App ID and Secret Key from Cashfree Dashboard → Developers → API Keys (Test mode). Click **Save**, then **Test connection**.
2. Turn on **Online payments** and make a test purchase from a company account.
3. **Going live.** Paste the Production keys, set the mode to *Production* and save. In the Cashfree dashboard:
   - add the **Webhook URL** shown on the page and subscribe to payment success, failed and user-dropped events;
   - whitelist your domain (`app.gosoft.in`), which Cashfree requires for production checkouts.
4. Secret keys are encrypted and can't be read back. To rotate a key, paste the new one and save.
5. **GST on subscriptions.** The rate and the seller details (legal name, GSTIN, state code, address) are printed on every tax invoice. Intra-state buyers get CGST + SGST and other states get IGST.

*Payments* lists every order:
- **Re-check (↻)** asks Cashfree for the latest status.
- **Refund** sends a full or partial refund through Cashfree.
- **Webhook logs** show each delivery, whether its signature was valid, and what happened.
- **Subscription invoices** lists every GST invoice issued.

*Coupons:* percentage or flat amount, a maximum discount, a validity window, limits on plans or billing cycle, a usage cap, and once-per-company.

### Website CMS & blog
- **Website CMS** controls everything on the public site: hero text, announcement bar, contact details (phone 9799289697 and the Jaipur address are preloaded), social links, testimonials (publish only genuine ones), FAQs, the 8 SEO landing pages, SEO defaults, the Search Console verification code, sitemap extras and 301 redirects. Changes go live within about 5 minutes.
- **Blog:** write in Markdown with a live preview. Choose Draft, Published, or Scheduled (which goes live on its own at the set time), and fill in the SEO title, description and slug. Published posts appear in `/sitemap.xml` automatically.

## Company Owner / Admin

### Default roles
| Role | Can |
|---|---|
| Company Owner | Everything, including the subscription. Locked and cannot be removed |
| Company Admin | Everything except managing the subscription |
| HR Manager | Employees, attendance, leave, documents, payroll preparation |
| Accountant | Invoices, customers, products, vendors, expenses, financial reports |
| Team Manager | Their team's attendance/leave approvals, assigned projects, team tasks |
| Employee | Their own attendance, leave, payslips and documents, plus assigned tasks |

On plans with **Custom roles** (Business and Enterprise), admins can create roles from the permission matrix. Each row (resource) gets a scope:
- **Own:** only their own records
- **Assigned:** records assigned to them
- **Team:** people who report to them
- **Department**
- **Company:** everything in the workspace

You can only grant permissions that you hold yourself.

### Users
Invitations are emailed and valid for 7 days. Deactivating a user frees their seat and signs them out. Removed users stay in the audit log.

### Setting up the modules (recommended order)
1. **Company Settings:** add your GSTIN and address. Your state code decides whether invoices use CGST + SGST or IGST.
2. **Billing Settings:** invoice prefixes, bank/UPI details, terms and signatory.
3. **Customers & Products:** add each customer's GSTIN or state, and each product's HSN/SAC and GST rate.
4. **HR Settings, Holidays and Leave Policies.** Four default leave types and four departments are created for you.
5. **Employees:** add employees with their salary structure, then click the 🔑 key icon to invite each one so they can use *My Workspace*.
6. **Statutory Settings:** check the PF, ESI and PT rates and slabs for your state with your payroll consultant.
7. **Payroll:** run payroll → review it and adjust individual payslips → approve → mark as paid → download the bank transfer CSV.

### Employees
Employees log in to **My Workspace**, where they can check in/out, apply for leave, see their balances and payslips, see tasks assigned to them, read announcements, and raise requests. Managers approve leave and attendance corrections for the people who report to them, which is set by the *Reporting manager* field.
