# GO SOFT API — v1

Base URL: `/api/v1`. All bodies are JSON. Authenticated requests send `Authorization: Bearer <accessToken>`.

**Responses** — success: `{ "success": true, "data": …, "meta"?: { total, page, limit, pages } }`
error: `{ "success": false, "error": { "code": "…", "message": "…", "details"?: … } }`

### Error codes the frontend should handle
| HTTP | code | Meaning |
|---|---|---|
| 401 | `TOKEN_EXPIRED` / `INVALID_TOKEN` | Call `POST /auth/refresh`, then retry |
| 401 | `TOKEN_REVOKED` / `TOKEN_REUSE` | Session ended, send the user to login |
| 402 | `SUBSCRIPTION_EXPIRED` | Read-only (grace / expired); writes are blocked |
| 402 | `SUBSCRIPTION_REQUIRED` | No subscription, or blocked after grace |
| 403 | `PERMISSION_DENIED` / `SCOPE_DENIED` | Role lacks the permission |
| 403 | `MODULE_NOT_IN_PLAN` | Upgrade needed (`details.module`) |
| 403 | `LIMIT_REACHED` | Plan limit hit (`details.limit`, `max`, `current`) |
| 403 | `COMPANY_SUSPENDED` / `COMPANY_BLOCKED` / `COMPANY_PENDING` | Company status (`details.reason`) |
| 403 | `EMAIL_NOT_VERIFIED`, `ACCOUNT_INACTIVE` | Login blockers |
| 403 | `ESCALATION_DENIED` | Tried to grant a permission you don't hold |
| 423 | `ACCOUNT_LOCKED` | Too many failed logins |
| 429 | `RATE_LIMITED` | Slow down |
| 503 | `MAINTENANCE` | Platform maintenance mode |

## Public
| Method | Path | Notes |
|---|---|---|
| GET | `/public/plans` | Public, non-archived plans + module labels |
| GET | `/public/config` | Registration mode, GSTIN rules, password policy, trial, maintenance, support |
| POST | `/public/leads` | `{ type: contact\|demo, name, email, phone?, company?, employees?, message? }` — 10/hour/IP |

## Auth
| Method | Path | Body / notes |
|---|---|---|
| POST | `/auth/register` | `{ companyName, businessType, industry?, gstin?, phone?, name, email, password, planSlug?, inviteCode?, acceptTerms: true }` → either `{ requiresVerification }` or `{ accessToken, session }` |
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, session }` and sets the `gs_rt` refresh cookie |
| POST | `/auth/refresh` | Cookie-based. Rotates the refresh token → `{ accessToken, session }` |
| POST | `/auth/logout` | Revokes the current refresh token |
| POST | `/auth/logout-all` | 🔒 Revokes every session (bumps tokenVersion) |
| GET / PATCH | `/auth/me` | 🔒 Session payload / update `{ name?, phone? }` |
| POST | `/auth/verify-email` | `{ token }` |
| POST | `/auth/resend-verification` | `{ email }` |
| POST | `/auth/forgot-password` | `{ email }` — same response whether or not the account exists |
| POST | `/auth/reset-password` | `{ token, password }` — also used to accept invitations |
| POST | `/auth/change-password` | 🔒 `{ currentPassword, newPassword }` → new `accessToken` |

**Session payload** (`session`): `user`, `panel` (`super_admin` \| `company`), `company`, `role`, `permissions[]` (`{key, scope}`), `subscription` (`state`, `canWrite`, `endsAt`, `daysLeft`, `warning`, `plan{modules}`), `limits`, `maintenance`, `support`.

## Company (tenant) — 🔒 company users only
Every route runs `authenticate → loadTenant → guard(policy) → validate`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/company/dashboard` | — | Usage, modules, subscription, recent activity |
| GET | `/company/settings` | `core.company.view` | |
| PATCH | `/company/settings` | `core.company.edit` | name, phone, industry, businessType, gstin, pan, address{}, settings{} |
| GET | `/company/users` | `core.user.view` | `?q&status&page&limit` — narrowed by scope |
| POST | `/company/users` | `core.user.create` + **users limit** | Sends invitation `{ name, email, role, phone?, manager?, designation?, department? }` |
| PATCH | `/company/users/:id` | `core.user.edit` | Owner role assignable only by the Owner; you can't change your own role |
| PATCH | `/company/users/:id/status` | `core.user.manage` | `{ status: active\|inactive }` — deactivation ends sessions |
| POST | `/company/users/:id/resend-invite` | `core.user.create` | |
| DELETE | `/company/users/:id` | `core.user.delete` | Soft delete; Owner and self are protected |
| GET | `/company/permissions` | `core.role.view` | Catalog: modules, resources, scopes, planModules |
| GET | `/company/roles` | `core.role.view` | With user counts |
| POST / PATCH / DELETE | `/company/roles[/:id]` | `core.role.*` + module `customRoles` | `{ name, description?, permissions:[{key,scope}] }`; locked roles are immutable |
| GET | `/company/subscription` | `core.subscription.view` | Works even when the subscription is blocked |
| GET | `/company/audit-logs` | `core.audit.view` | `?action&page` |

## Super Admin — 🔒 `isSuperAdmin` only
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | Platform KPIs, 12-month registrations, plan distribution |
| GET | `/admin/meta` | Modules, resources, scopes |
| GET | `/admin/companies` | `?q&status&plan&page` |
| GET | `/admin/companies/:id` | Company, subscription (+ effective state), users, activity |
| PATCH | `/admin/companies/:id/status` | `{ action: activate\|suspend\|reactivate\|block, reason?, category? }` — block revokes all sessions |
| POST | `/admin/companies/:id/trial` | `{ days, note? }` |
| PATCH | `/admin/companies/:id/subscription` | `{ planId?, status?, billingCycle?, periodEnd?, graceDaysOverride?, note? }` |
| PATCH | `/admin/companies/:id/limits` | `{ users?, employees?, invoicesPerMonth?, storageMB? }` (`null` = plan default, `-1` = unlimited) |
| GET / POST | `/admin/plans` | |
| PATCH | `/admin/plans/:id` | |
| PATCH | `/admin/plans/:id/archive` | `{ archived: boolean }` |
| GET / PATCH | `/admin/policies` | Partial update per section (registration, trial, subscription, password, session, rateLimit, uploads, dataRetention, notifications, maintenance) |
| GET | `/admin/audit-logs` | `?q&action&company&page` |
| GET / PATCH | `/admin/leads[/:id]` | `{ status }` |

`GET /api/health` — liveness probe.

## Billing — `/company/billing` (module `billing`)
| Method | Path | Permission |
|---|---|---|
| CRUD | `/customers`, `/vendors`, `/products`, `/expenses` (+ `/export.csv` for customers/expenses) | `billing.<resource>.*` |
| GET | `/customers/:id/ledger` | `billing.customer.view` |
| GET / POST | `/invoices` (`?type&status&q&customer&from&to`) | `billing.invoice.view/create` (+ `invoicesPerMonth` limit) |
| GET / PATCH | `/invoices/:id` | view / edit (not after payment) |
| POST | `/invoices/:id/cancel` | `billing.invoice.delete` |
| POST | `/invoices/:id/payments` `{ amount, date, mode, reference }` | `billing.invoice.edit` |
| GET | `/invoices/export.csv`, `/receipts` | export / view |
| GET | `/reports/summary?from&to` | `billing.invoice.view` |
| GET / PATCH | `/settings` | `billing.settings.view/configure` |

Invoice body: `{ type, customer, date, dueDate, placeOfSupply, taxInclusive, discountTotal, items: [{ product?, description, hsnSac, unit, quantity, rate, discountPercent, taxRate }], notes, terms, status }`. The server computes all taxes; client totals are never trusted.

## HRMS — `/company/hr` (module `hrms`)
| Method | Path | Notes |
|---|---|---|
| CRUD | `/employees` (+ `/export.csv`) | `employees` limit; salary/bank only for company-scope payroll roles; bank no. & PAN encrypted |
| POST | `/employees/:id/create-login` | Invites the employee with the Employee role and links the login |
| CRUD | `/departments`, `/holidays`, `/leave-types` | `GET /holidays/calendar` for everyone |
| GET | `/attendance/me/today` · POST `/attendance/me/check-in|break-start|break-end|check-out` | Self-service |
| GET | `/attendance?from&to&mine&correction=pending` | Scoped own/team/company |
| POST | `/attendance/me/correction` · `/attendance/:id/correction { approve }` | Request / approve |
| GET | `/leaves?mine&status`, `/leaves/me/balance`, `/leaves/balance/:employeeId` | |
| POST | `/leaves` · `/leaves/:id/review { approve, note }` · `/leaves/:id/cancel` | Overlap, balance, holidays and weekly offs are validated |
| GET / POST | `/requests` · POST `/requests/:id/respond` | Employee requests |
| GET / PATCH | `/settings` | Shift, grace, full/half-day hours, weekly offs |

## Payroll — `/company/payroll` (module `payroll`)
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/settings` | PF/ESI/PT/TDS/overtime rules |
| GET / POST | `/runs` `{ month, year }` | Calculates payslips for all active employees |
| GET / DELETE | `/runs/:id` | Delete only while draft |
| POST | `/runs/:id/approve`, `/runs/:id/mark-paid` | Approve notifies employees |
| GET | `/runs/:id/export.csv` | Bank transfer file |
| PATCH | `/payslips/:id` `{ paidDays, overtimeHours, bonus, incentive, advanceRecovery, otherDeductions }` | Draft only |
| GET | `/payslips/me`, `/payslips/:id` | Employees see only their approved payslips |

## Work — `/company/work` (module `tasks`)
CRUD `/projects`, CRUD `/tasks` (`?project&status&priority&q`), POST `/tasks/:id/comments`, GET `/people`. Completing a task that has an approver moves it to *review* unless the user can approve.

## Workspace
`/company/announcements` (CRUD), `/company/notifications` (GET, POST `/read`), `/company/me/home`, `/company/analytics` (module `analytics`).

## Subscription payments — `/company/subscription`
| Method | Path | Notes |
|---|---|---|
| POST | `/quote` `{ planId, billingCycle, couponCode? }` | Price + discount + GST |
| POST | `/checkout` | `core.subscription.manage` → `{ orderId, paymentSessionId, mode }` for Cashfree JS SDK v3 |
| GET | `/verify/:orderId` | Re-checks the order with Cashfree and activates if PAID |
| POST | `/cancel`, `/resume` | Cancel at period end / undo |
| GET | `/payments`, `/invoices/:id` | History and GST tax invoices |

`POST /api/v1/webhooks/cashfree`: raw body, `x-webhook-signature` = base64(HMAC-SHA256(timestamp + body, secretKey)). Requests with a timestamp older than 15 minutes are rejected, every delivery is logged, and the order is re-fetched from Cashfree before acting.

## Super Admin additions — `/admin`
`GET/PATCH /gateway` (secrets write-only), `POST /gateway/test`, `GET /payments`, `POST /payments/:id/sync`, `POST /payments/:id/refund { amount, note }`, `GET /platform-invoices[/:id]`, `GET /webhook-logs`, CRUD `/coupons`, CRUD `/blog/posts`, `/blog/categories`, `GET/PATCH /site`.

## Public additions
`GET /public/site`, `GET /public/blog?category&tag&q&page`, `GET /public/blog/:slug`, `GET /sitemap.xml`, `GET /robots.txt`.
