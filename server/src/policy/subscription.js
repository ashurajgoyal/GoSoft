/**
 * Computes the effective subscription state at a point in time. Pure function — no DB access —
 * so it is unit-tested and gives the same answer whether or not a cron job has run.
 *
 * States:
 *   trialing  – inside the free trial            → full access to plan modules
 *   active    – paid period running              → full access
 *   grace     – period ended, inside grace days  → read-only + renew + export
 *   read_only – grace ended, policy = read_only  → read-only + renew + export (if allowed)
 *   blocked   – grace ended, policy = blocked    → only subscription/renewal endpoints
 *   none      – company has no subscription      → only subscription endpoints
 */
const DAY = 24 * 60 * 60 * 1000;

export function computeSubscriptionState(sub, platformSubscriptionPolicy = {}, now = new Date()) {
  const policy = { graceDays: 7, afterGrace: 'read_only', expiryWarningDays: 7, ...platformSubscriptionPolicy };
  if (!sub) return { state: 'none', canWrite: false, endsAt: null, daysLeft: 0, warning: 'No active subscription' };

  const t = now.getTime();
  const end = sub.status === 'trialing' ? sub.trialEndsAt : (sub.currentPeriodEnd || sub.trialEndsAt);
  const endMs = end ? new Date(end).getTime() : 0;
  const graceDays = sub.graceDaysOverride ?? policy.graceDays;

  // Explicitly expired subscriptions skip straight to the post-period evaluation.
  if (sub.status !== 'expired' && endMs > t) {
    const daysLeft = Math.ceil((endMs - t) / DAY);
    const state = sub.status === 'trialing' ? 'trialing' : 'active';
    let warning = null;
    if (sub.status === 'past_due') warning = 'Your last payment failed. Please update your payment to avoid interruption.';
    else if (sub.cancelAtPeriodEnd) warning = `Your subscription is cancelled and ends in ${daysLeft} day(s).`;
    else if (daysLeft <= policy.expiryWarningDays) {
      warning = state === 'trialing'
        ? `Your free trial ends in ${daysLeft} day(s). Choose a plan to keep full access.`
        : `Your subscription renews/expires in ${daysLeft} day(s).`;
    }
    return { state, canWrite: true, endsAt: end, daysLeft, warning };
  }

  const graceEnd = endMs + graceDays * DAY;
  if (t < graceEnd) {
    return {
      state: 'grace', canWrite: false, endsAt: end, graceEndsAt: new Date(graceEnd),
      daysLeft: Math.ceil((graceEnd - t) / DAY),
      warning: 'Your subscription has expired. Your workspace is read-only during the grace period — renew to restore full access.',
    };
  }

  const blocked = policy.afterGrace === 'blocked';
  return {
    state: blocked ? 'blocked' : 'read_only', canWrite: false, endsAt: end, graceEndsAt: new Date(graceEnd), daysLeft: 0,
    warning: blocked
      ? 'Your subscription has expired. Renew your plan to access your workspace. Your data is safe and has not been deleted.'
      : 'Your subscription has expired. Your workspace is read-only. Your data is safe — renew to continue.',
  };
}
