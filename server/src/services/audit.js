import { AuditLog } from '../models/index.js';

/** Fire-and-forget audit entry. Never throws into the request path. */
export function audit(req, action, { company, targetType, targetId, summary, meta, actor } = {}) {
  const user = actor || req?.user;
  return AuditLog.create({
    company: company ?? req?.tenantId ?? null,
    actor: user?._id || null,
    actorName: user?.name,
    actorType: !user ? 'anonymous' : user.isSuperAdmin ? 'super_admin' : 'company_user',
    action, targetType, targetId: targetId ? String(targetId) : undefined, summary, meta,
    ip: req?.ip, userAgent: req?.get?.('user-agent'),
  }).catch((err) => console.error('[audit] failed', err.message));
}
