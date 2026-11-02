# Deployment: taking GO SOFT live

## Option A: one server with Docker (simplest)
A VPS with 2 vCPU and 4 GB RAM (AWS Lightsail, DigitalOcean, Hostinger VPS, etc.) running Ubuntu 22.04+.

```bash
# 1. Install Docker, then copy the project to the server
cp server/.env.example server/.env        # fill in real values (see below)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api node src/seed.js     # plans, super admin, CMS, blog
```

2. Point your DNS: `app.gosoft.in` (or `www.gosoft.in`) → the server IP.
3. **HTTPS is mandatory** (Cashfree production requires it). The easiest way is [Caddy](https://caddyserver.com) in front of port 80, using a Caddyfile like:
   ```
   www.gosoft.in, app.gosoft.in {
     reverse_proxy localhost:80
   }
   ```
   Cloudflare (proxied DNS + "Full" SSL) also works.

The `web` container serves the React app and proxies `/api`, `/sitemap.xml` and `/robots.txt` to the API, so the whole product runs on **one domain**. That keeps the refresh cookie first-party and the webhook URL simple: `https://www.gosoft.in/api/v1/webhooks/cashfree`.

## Option B: managed services
- **Database:** MongoDB Atlas (M10+, with backups and point-in-time restore on).
- **API:** Render, Railway or an EC2 instance with PM2. Run `npm ci --omit=dev && node src/seed.js && node src/server.js`.
- **Web:** `npm run build` with `VITE_API_URL=https://api.gosoft.in` (keep it on the same parent domain), then deploy `dist/` to Vercel, Netlify or Nginx with an SPA fallback.

## Production `server/.env`
```
NODE_ENV=production
MONGODB_URI=mongodb://mongo:27017/gosoft            # or your Atlas URI
APP_URL=https://www.gosoft.in
API_URL=https://www.gosoft.in                        # public HTTPS; webhook = API_URL/api/v1/webhooks/cashfree
PUBLIC_SITE_URL=https://www.gosoft.in
CLIENT_ORIGINS=https://www.gosoft.in,https://app.gosoft.in
JWT_ACCESS_SECRET=<openssl rand -hex 48>
JWT_REFRESH_SECRET=<openssl rand -hex 48>
DATA_ENCRYPTION_KEY=<openssl rand -hex 32>          # BACK THIS UP: encrypted keys/bank data need it
SUPERADMIN_EMAIL=…  SUPERADMIN_PASSWORD=…
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM   # e.g. Zoho, SES, Brevo, Gmail Workspace
SUPPORT_EMAIL=support@gosoft.in
SUPPORT_PHONE=9799289697
```
The API refuses to start in production while the default JWT secrets are still set.

## Go-live checklist
- [ ] HTTPS working on every domain
- [ ] Super Admin password changed, strong secrets set, `DATA_ENCRYPTION_KEY` backed up somewhere safe
- [ ] SMTP verified (SPF/DKIM on the sending domain): test with "forgot password"
- [ ] Super Admin → Payment Gateway: production keys saved, **Test connection** OK, mode = Production, payments enabled
- [ ] Cashfree dashboard: webhook URL added (payment success, failed and user-dropped events), domain whitelisted
- [ ] One real ₹1 test: create a temporary plan priced at ₹1, buy it, check the invoice, then refund it from Payments
- [ ] Website CMS: contact details, testimonials (genuine ones only), SEO defaults, Search Console verification
- [ ] Submit `https://www.gosoft.in/sitemap.xml` in Google Search Console
- [ ] Legal pages reviewed by your legal advisor (`client/src/pages/marketing/Legal.jsx`)
- [ ] Payroll statutory settings confirmed by your payroll consultant
- [ ] Database backups scheduled (`mongodump` cron, or Atlas backups)

## Scaling notes
- Run more than one API replica behind a load balancer and set `DISABLE_JOBS=true` on all but one. The scheduled jobs (reminders, housekeeping) also use atomic claims, so they never double-send.
- The scheduled jobs live in `server/src/services/jobs.js` and can move to BullMQ + Redis workers unchanged.
- Rate limits are in-memory per instance. For multiple replicas, plug a Redis store into `express-rate-limit`.

## SEO note
Public pages are a client-rendered React SPA. They set a title, description and canonical URL per page, add JSON-LD (Organization, SoftwareApplication, FAQ, Article), and are covered by a dynamic sitemap. Googlebot renders them, but for the best crawl performance add pre-rendering for the marketing and blog routes (for example `vite-plugin-prerender`, or a prerender service like prerender.io in Nginx).

## Testing before launch
- `cd server && npm test`: 22 unit tests (policy engine, GST, payroll, attendance, webhook signature, CSV safety).
- Manual run-through: register → verify email → invite a user → create an invoice and record a payment → add an employee and invite them → check in/out → apply for leave and approve it → run, approve and pay payroll → create a task and move it on the board → subscribe with sandbox Cashfree.
- Load testing (e.g. `k6`) and a penetration test should be run against your staging server.
