import { Payment, Plan, Coupon, Subscription, Company, PlatformInvoice, PaymentGateway, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { nextPlatformSeq } from './counter.js';
import { financialYear } from '../policy/gst.js';
import { sendMail } from './mailer.js';
import { audit } from './audit.js';
import { getCashfreeConfig, fetchOrder, fetchOrderPayments } from './cashfree.js';
import { env } from '../config/env.js';

const DAY = 864e5;
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Price quote with coupon + GST. Pure apart from coupon lookup. */
export async function quote({ plan, billingCycle, couponCode, companyId }) {
  const gw = await PaymentGateway.findOne({ provider: 'cashfree' }).lean();
  const gstRate = gw?.gstRate ?? 18;
  const amount = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
  let discount = 0; let coupon = null;
  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim(), active: true }).lean();
    const now = new Date();
    const invalid = !coupon
      || (coupon.validFrom && coupon.validFrom > now) || (coupon.validTo && coupon.validTo < now)
      || (coupon.maxRedemptions && coupon.redemptions >= coupon.maxRedemptions)
      || (coupon.plans?.length && !coupon.plans.some((p) => String(p) === String(plan._id)))
      || (coupon.billingCycles?.length && !coupon.billingCycles.includes(billingCycle));
    if (invalid) throw ApiError.badRequest('This coupon code is invalid or has expired.');
    if (coupon.oncePerCompany && companyId && (await Payment.exists({ company: companyId, 'coupon.id': coupon._id, status: 'paid' }))) {
      throw ApiError.badRequest('This coupon has already been used by your company.');
    }
    discount = coupon.type === 'percent' ? (amount * coupon.value) / 100 : coupon.value;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = r2(Math.min(discount, amount));
  }
  const taxableAmount = r2(amount - discount);
  const gst = r2((taxableAmount * gstRate) / 100);
  return { amount, discount, taxableAmount, gst, gstRate, total: r2(taxableAmount + gst), coupon };
}

/**
 * Activates the subscription for a verified PAID payment. Idempotent: the atomic
 * `processedAt: null → now` claim guarantees activation runs exactly once even if the
 * webhook and the browser verification arrive at the same time.
 */
export async function activatePayment(paymentId, { cfPaymentId, paymentMethod } = {}) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, processedAt: null },
    { $set: { processedAt: new Date(), status: 'paid', paidAt: new Date(), cfPaymentId, paymentMethod } },
    { new: true },
  );
  if (!payment) return { alreadyProcessed: true };

  const plan = await Plan.findById(payment.plan).lean();
  const now = new Date();
  let sub = await Subscription.findOne({ company: payment.company });
  const days = payment.billingCycle === 'annual' ? 365 : 30;
  // Same plan renewal while still active → extend from current period end; otherwise start now.
  const extend = sub && sub.status === 'active' && String(sub.plan) === String(plan._id) && sub.currentPeriodEnd > now;
  const start = extend ? sub.currentPeriodEnd : now;
  const end = new Date(start.getTime() + days * DAY);
  if (!sub) sub = new Subscription({ company: payment.company, plan: plan._id });
  Object.assign(sub, { plan: plan._id, status: 'active', billingCycle: payment.billingCycle, currentPeriodStart: extend ? sub.currentPeriodStart : now,
    currentPeriodEnd: end, cancelAtPeriodEnd: false, cancelledAt: undefined });
  sub.history.push({ event: `payment_${payment.purpose}`, plan: plan._id, by: payment.user, note: `₹${payment.total} via Cashfree · ${payment.orderId} · until ${end.toDateString()}` });
  await sub.save();

  if (payment.coupon?.id) await Coupon.updateOne({ _id: payment.coupon.id }, { $inc: { redemptions: 1 } });

  // Platform tax invoice
  const [company, gw] = await Promise.all([Company.findById(payment.company).lean(), PaymentGateway.findOne({ provider: 'cashfree' }).lean()]);
  const seller = gw?.seller || {};
  const buyerState = company.address?.stateCode || company.gstin?.slice(0, 2);
  const intra = buyerState && seller.stateCode && buyerState === seller.stateCode;
  const fy = financialYear(now);
  const number = `GS/${fy}/${String(await nextPlatformSeq(`platform-invoice:${fy}`)).padStart(5, '0')}`;
  const invoice = await PlatformInvoice.create({
    number, company: company._id, payment: payment._id, seller,
    billedTo: { name: company.name, email: company.email, gstin: company.gstin, stateCode: buyerState,
      address: [company.address?.line1, company.address?.city, company.address?.state, company.address?.pincode].filter(Boolean).join(', ') },
    description: `GO SOFT ${plan.name} plan — ${payment.billingCycle} subscription`, periodStart: sub.currentPeriodStart, periodEnd: end,
    amount: payment.amount, discount: payment.discount, taxableAmount: payment.taxableAmount,
    cgst: intra ? r2(payment.gst / 2) : 0, sgst: intra ? r2(payment.gst / 2) : 0, igst: intra ? 0 : payment.gst, total: payment.total,
  });
  payment.invoice = invoice._id;
  await payment.save();

  const owner = await User.findById(company.owner).select('email name').lean();
  sendMail({ to: owner?.email || company.email, subject: `Payment received — GO SOFT ${plan.name}`, title: 'Thank you for your payment',
    html: `<p>Hi ${owner?.name || ''},</p><p>We received <b>₹${payment.total}</b> for the <b>${plan.name}</b> plan (${payment.billingCycle}). Your subscription is active until <b>${end.toDateString()}</b>.</p><p>Invoice: ${number}</p><p><a href="${env.appUrl}/app/subscription">View subscription & invoice</a></p>` });
  audit(null, 'subscription.activated', { company: company._id, targetType: 'Payment', targetId: payment._id, summary: `${plan.name} ${payment.billingCycle} · ₹${payment.total}` });
  return { payment, subscription: sub, invoice };
}

/** Confirms an order's status directly with Cashfree (never trust the browser) and activates if paid. */
export async function reconcileOrder(payment) {
  const cfg = await getCashfreeConfig({ requireEnabled: false });
  const order = await fetchOrder(cfg, payment.orderId);
  if (order.order_status === 'PAID') {
    if (Number(order.order_amount) !== Number(payment.total)) {
      await Payment.updateOne({ _id: payment._id }, { status: 'failed', failureReason: `Amount mismatch: expected ${payment.total}, got ${order.order_amount}` });
      throw new ApiError(409, 'Payment amount mismatch. Please contact support.', 'AMOUNT_MISMATCH');
    }
    let cfPaymentId; let paymentMethod;
    try {
      const pays = await fetchOrderPayments(cfg, payment.orderId);
      const ok = (Array.isArray(pays) ? pays : []).find((p) => p.payment_status === 'SUCCESS');
      cfPaymentId = ok?.cf_payment_id ? String(ok.cf_payment_id) : undefined;
      paymentMethod = ok?.payment_group;
    } catch { /* payment details are optional */ }
    const result = await activatePayment(payment._id, { cfPaymentId, paymentMethod });
    return { status: 'paid', ...result };
  }
  if (order.order_status === 'EXPIRED' || order.order_status === 'TERMINATED') {
    await Payment.updateOne({ _id: payment._id, status: { $in: ['created', 'pending'] } }, { status: 'expired' });
    return { status: 'expired' };
  }
  // ACTIVE = not paid yet; check if last attempt failed
  try {
    const pays = await fetchOrderPayments(cfg, payment.orderId);
    const last = Array.isArray(pays) ? pays[0] : null;
    if (last && ['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(last.payment_status)) {
      await Payment.updateOne({ _id: payment._id, processedAt: null }, { status: 'failed', failureReason: last.payment_message || last.payment_status });
      return { status: 'failed', reason: last.payment_message || last.payment_status };
    }
  } catch { /* ignore */ }
  return { status: 'pending' };
}
