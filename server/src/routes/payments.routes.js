import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { Payment, Plan, PlatformInvoice, WebhookLog, Subscription, User } from '../models/index.js';
import { guard } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { randomToken } from '../utils/tokens.js';
import { getCashfreeConfig, createOrder, verifyWebhookSignature } from '../services/cashfree.js';
import { quote, reconcileOrder } from '../services/subscriptionBilling.js';
import { computeSubscriptionState } from '../policy/subscription.js';
import { audit } from '../services/audit.js';
import { env } from '../config/env.js';

/* ----------------------- Company: subscription checkout --------------------- */
export const companyPayments = Router();
const sub = { permission: 'core.subscription.manage', subscriptionRoute: true };

const checkoutSchema = z.object({ planId: z.string().regex(/^[a-f\d]{24}$/i), billingCycle: z.enum(['monthly', 'annual']), couponCode: z.string().trim().max(40).optional() });

companyPayments.post('/quote', guard({ permission: 'core.subscription.view', subscriptionRoute: true }), validate({ body: checkoutSchema }), h(async (req, res) => {
  const plan = await Plan.findOne({ _id: req.body.planId, isArchived: false }).lean();
  if (!plan) throw ApiError.notFound('Plan not found');
  const q = await quote({ plan, billingCycle: req.body.billingCycle, couponCode: req.body.couponCode, companyId: req.tenantId });
  res.json({ success: true, data: { ...q, coupon: q.coupon && { code: q.coupon.code, description: q.coupon.description } } });
}));

companyPayments.post('/checkout', guard(sub), validate({ body: checkoutSchema }), h(async (req, res) => {
  const plan = await Plan.findOne({ _id: req.body.planId, isArchived: false }).lean();
  if (!plan) throw ApiError.notFound('Plan not found');
  const { company, subscription, plan: currentPlan } = req.ctx;

  // Downgrade guard: the new plan's limits must fit current usage.
  const seats = await User.countDocuments({ company: req.tenantId, deletedAt: null, status: { $ne: 'inactive' } });
  if (plan.limits?.users !== -1 && seats > plan.limits.users) throw ApiError.badRequest(`The ${plan.name} plan allows ${plan.limits.users} users but you have ${seats}. Deactivate users first.`);

  const q = await quote({ plan, billingCycle: req.body.billingCycle, couponCode: req.body.couponCode, companyId: req.tenantId });
  if (q.total < 1) throw ApiError.badRequest('Order total must be at least ₹1.');
  const cfg = await getCashfreeConfig();
  const state = computeSubscriptionState(subscription, req.ctx.platform.subscription);
  const purpose = !subscription || state.state === 'trialing' ? 'new'
    : String(currentPlan?._id) === String(plan._id) ? 'renewal'
      : (plan.priceMonthly > (currentPlan?.priceMonthly || 0) ? 'upgrade' : 'downgrade');

  const orderId = `GS_${Date.now()}_${randomToken(4)}`;
  const payment = await Payment.create({
    company: req.tenantId, user: req.user._id, plan: plan._id, billingCycle: req.body.billingCycle, purpose, orderId, mode: cfg.mode,
    amount: q.amount, discount: q.discount, taxableAmount: q.taxableAmount, gst: q.gst, total: q.total,
    coupon: q.coupon ? { code: q.coupon.code, id: q.coupon._id } : undefined,
  });
  try {
    const order = await createOrder(cfg, {
      order_id: orderId, order_amount: q.total, order_currency: 'INR',
      customer_details: { customer_id: String(req.tenantId), customer_name: req.user.name.slice(0, 100), customer_email: req.user.email,
        customer_phone: (req.user.phone || company.phone || '9999999999').replace(/\D/g, '').slice(-10) },
      order_meta: {
        return_url: `${env.appUrl}/app/subscription?order_id={order_id}`,
        // Cashfree only delivers webhooks to public HTTPS URLs; locally the return-page verification activates the plan.
        ...(env.apiUrl.startsWith('https://') ? { notify_url: `${env.apiUrl}/api/v1/webhooks/cashfree` } : {}),
      },
      order_note: `GO SOFT ${plan.name} (${req.body.billingCycle})`,
      order_tags: { company: String(req.tenantId), plan: plan.slug },
    });
    payment.cfOrderId = String(order.cf_order_id || '');
    payment.paymentSessionId = order.payment_session_id;
    payment.status = 'pending';
    await payment.save();
    audit(req, 'payment.checkout', { targetType: 'Payment', targetId: payment._id, summary: `${plan.name} ${req.body.billingCycle} · ₹${q.total}` });
    res.status(201).json({ success: true, data: { orderId, paymentSessionId: order.payment_session_id, mode: cfg.mode, total: q.total } });
  } catch (e) {
    payment.status = 'failed'; payment.failureReason = e.message;
    await payment.save();
    throw e;
  }
}));

companyPayments.get('/verify/:orderId', guard({ permission: 'core.subscription.view', subscriptionRoute: true }), h(async (req, res) => {
  const payment = await Payment.findOne({ company: req.tenantId, orderId: req.params.orderId });
  if (!payment) throw ApiError.notFound('Order not found');
  if (payment.status === 'paid') return res.json({ success: true, data: { status: 'paid' } });
  const result = await reconcileOrder(payment);
  res.json({ success: true, data: { status: result.status, reason: result.reason } });
}));

companyPayments.post('/cancel', guard(sub), h(async (req, res) => {
  const s = await Subscription.findOne({ company: req.tenantId });
  if (!s || s.status !== 'active') throw ApiError.badRequest('There is no active paid subscription to cancel.');
  s.cancelAtPeriodEnd = true; s.cancelledAt = new Date();
  s.history.push({ event: 'cancel_requested', plan: s.plan, by: req.user._id, note: 'Access continues until the end of the current period' });
  await s.save();
  audit(req, 'subscription.cancel', { targetType: 'Subscription', targetId: s._id });
  res.json({ success: true, data: s });
}));
companyPayments.post('/resume', guard(sub), h(async (req, res) => {
  const s = await Subscription.findOne({ company: req.tenantId });
  if (!s?.cancelAtPeriodEnd) throw ApiError.badRequest('Subscription is not scheduled for cancellation.');
  s.cancelAtPeriodEnd = false; s.cancelledAt = undefined;
  s.history.push({ event: 'cancel_reverted', plan: s.plan, by: req.user._id });
  await s.save();
  res.json({ success: true, data: s });
}));

companyPayments.get('/payments', guard({ permission: 'core.subscription.view', subscriptionRoute: true }), h(async (req, res) => {
  const items = await Payment.find({ company: req.tenantId }).sort({ createdAt: -1 }).limit(50).populate('plan', 'name').select('-paymentSessionId').lean();
  res.json({ success: true, data: items });
}));
companyPayments.get('/invoices/:id', guard({ permission: 'core.subscription.view', subscriptionRoute: true }), h(async (req, res) => {
  const inv = await PlatformInvoice.findOne({ company: req.tenantId, _id: req.params.id }).lean();
  if (!inv) throw ApiError.notFound('Invoice not found');
  res.json({ success: true, data: inv });
}));

/* --------------------------- Cashfree webhook (public) ---------------------- */
export const webhooks = Router();
webhooks.post('/cashfree', express.raw({ type: '*/*', limit: '1mb' }), h(async (req, res) => {
  const raw = req.body instanceof Buffer ? req.body : Buffer.from('');
  let payload = {};
  try { payload = JSON.parse(raw.toString('utf8')); } catch { /* logged below */ }
  const orderId = payload?.data?.order?.order_id;
  const log = new WebhookLog({ type: payload?.type, orderId, payload, ip: req.ip, processed: false });

  let cfg;
  try { cfg = await getCashfreeConfig({ requireEnabled: false }); } catch (e) { log.result = e.message; await log.save(); return res.status(503).json({ ok: false }); }
  log.signatureValid = verifyWebhookSignature(raw, req.get('x-webhook-timestamp'), req.get('x-webhook-signature'), cfg.secretKey);
  const ts = Number(req.get('x-webhook-timestamp'));
  const fresh = Number.isFinite(ts) && Math.abs(Date.now() - (ts > 1e12 ? ts : ts * 1000)) < 15 * 60 * 1000;
  if (!log.signatureValid || !fresh) { log.result = log.signatureValid ? 'Stale timestamp' : 'Invalid signature'; await log.save(); return res.status(401).json({ ok: false }); }

  try {
    const payment = orderId ? await Payment.findOne({ orderId }) : null;
    if (!payment) log.result = 'Unknown order';
    else if (payment.status === 'paid') { log.result = 'Already processed'; log.processed = true; }
    else {
      // Never trust the webhook body for the amount/status — re-fetch the order from Cashfree.
      const result = await reconcileOrder(payment);
      log.result = `Order status: ${result.status}`; log.processed = true;
    }
  } catch (e) { log.result = `Error: ${e.message}`; }
  await log.save();
  res.json({ ok: true });
}));
