import mongoose from 'mongoose';

/** Append-only. No update/delete routes exist for this collection. */
const auditLogSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: String,
  actorType: { type: String, enum: ['super_admin', 'company_user', 'system', 'anonymous'], default: 'company_user' },
  action: { type: String, required: true, index: true },   // e.g. company.suspend, role.update
  targetType: String,
  targetId: String,
  summary: String,
  meta: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ createdAt: -1 });

const block = function () { throw new Error('Audit logs are append-only'); };
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'replaceOne']) {
  auditLogSchema.pre(op, block);
}

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
