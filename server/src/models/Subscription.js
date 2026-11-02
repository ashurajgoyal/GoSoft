import mongoose from 'mongoose';

/**
 * One current subscription document per company.
 * Stored `status` is what billing set; the *effective* status (trial expired, grace, expired)
 * is always computed at request time by policy/subscription.js so time-based transitions never
 * depend on a cron job having run.
 */
const subscriptionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: { type: String, enum: ['trialing', 'active', 'past_due', 'cancelled', 'expired'], default: 'trialing', index: true },
  billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  trialEndsAt: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  cancelledAt: Date,
  /** Overrides platform grace days for this company (Super Admin). */
  graceDaysOverride: { type: Number, default: null },
  reminders: [{ _id: false, key: String, at: Date }],
  history: [{
    at: { type: Date, default: Date.now },
    event: String,
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
  }],
}, { timestamps: true });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
