import { Subscription, Company, User, Task, Payment, WebhookLog, AuditLog } from '../models/index.js';
import { getPlatformPolicy } from './platformPolicy.js';
import { computeSubscriptionState } from '../policy/subscription.js';
import { sendMail } from './mailer.js';
import { notify } from './notify.js';
import { env } from '../config/env.js';

/**
 * Lightweight in-process scheduler (runs every 30 minutes). Safe to run on several instances:
 * every job uses atomic "claim" updates so a reminder is sent once.
 * For large scale, move these to BullMQ + Redis workers — the functions are already isolated.
 */
const DAY = 864e5;

async function subscriptionReminders() {
  const platform = await getPlatformPolicy();
  const warnDays = platform.subscription?.expiryWarningDays ?? 7;
  const soon = new Date(Date.now() + warnDays * DAY);
  const subs = await Subscription.find({
    $or: [{ status: 'trialing', trialEndsAt: { $lte: soon } }, { status: { $in: ['active', 'past_due'] }, currentPeriodEnd: { $lte: soon } }],
  }).lean();
  for (const s of subs) {
    const state = computeSubscriptionState(s, platform.subscription);
    const key = `${state.state}:${new Date(state.endsAt).toISOString().slice(0, 10)}`;
    // Claim: only one reminder per state per period end.
    const claimed = await Subscription.updateOne({ _id: s._id, 'reminders.key': { $ne: key } }, { $push: { reminders: { key, at: new Date() } } }, { strict: false });
    if (!claimed.modifiedCount) continue;
    const company = await Company.findById(s.company).select('name email owner').lean();
    const owner = company && await User.findById(company.owner).select('email name').lean();
    if (!owner) continue;
    sendMail({ to: owner.email, subject: `GO SOFT: ${state.warning || 'Subscription update'}`, title: 'Subscription reminder',
      html: `<p>Hi ${owner.name},</p><p>${state.warning || 'Your subscription needs attention.'}</p><p><a href="${env.appUrl}/app/subscription">Manage subscription</a></p>` });
  }
}

async function taskReminders() {
  const now = new Date();
  const due = await Task.find({ reminderAt: { $lte: now }, status: { $ne: 'completed' }, deletedAt: null }).setOptions({ platformScope: true }).limit(500).lean();
  for (const t of due) {
    const claimed = await Task.updateOne({ company: t.company, _id: t._id, reminderAt: t.reminderAt }, { $unset: { reminderAt: 1 } });
    if (claimed.modifiedCount) notify(t.company, t.assignees, { title: '⏰ Task reminder', body: t.title, link: '/app/tasks', email: true });
  }
  // Overdue alerts once per task.
  const overdue = await Task.find({ dueDate: { $lt: now }, status: { $nin: ['completed', 'on_hold'] }, 'history.change': { $ne: 'overdue' }, deletedAt: null })
    .setOptions({ platformScope: true }).limit(500).lean();
  for (const t of overdue) {
    const claimed = await Task.updateOne({ company: t.company, _id: t._id, 'history.change': { $ne: 'overdue' } }, { $push: { history: { user: 'system', change: 'overdue' } } });
    if (claimed.modifiedCount) notify(t.company, t.assignees, { title: 'Task overdue', body: t.title, link: '/app/tasks' });
  }
}

async function housekeeping() {
  await Payment.updateMany({ status: { $in: ['created', 'pending'] }, createdAt: { $lt: new Date(Date.now() - 2 * DAY) } }, { status: 'expired' });
  await WebhookLog.deleteMany({ createdAt: { $lt: new Date(Date.now() - 90 * DAY) } });
  const platform = await getPlatformPolicy();
  const keep = platform.dataRetention?.auditLogRetentionDays ?? 730;
  await AuditLog.collection.deleteMany({ createdAt: { $lt: new Date(Date.now() - keep * DAY) } });
}

export function startJobs() {
  const run = async () => {
    for (const [name, fn] of [['subscription-reminders', subscriptionReminders], ['task-reminders', taskReminders], ['housekeeping', housekeeping]]) {
      try { await fn(); } catch (e) { console.error(`[jobs] ${name} failed:`, e.message); }
    }
  };
  setTimeout(run, 15_000).unref();
  setInterval(run, 30 * 60 * 1000).unref();
}
