import mongoose from 'mongoose';

/** Singleton document (key = 'platform') holding every Super Admin–configurable platform policy. */
const platformPolicySchema = new mongoose.Schema({
  key: { type: String, default: 'platform', unique: true },

  registration: {
    mode: { type: String, enum: ['open', 'invite', 'approval'], default: 'open' },
    emailVerificationRequired: { type: Boolean, default: true },
    phoneRequired: { type: Boolean, default: false },
    businessDetailsRequired: { type: Boolean, default: true },
    /** GSTIN requirement per business type: 'required' | 'optional' */
    gstinRule: { type: Map, of: String, default: { private_limited: 'optional', public_limited: 'optional' } },
    gstinDefault: { type: String, enum: ['required', 'optional'], default: 'optional' },
    allowedDomains: [String],
    blockedDomains: { type: [String], default: ['mailinator.com', 'tempmail.com', 'guerrillamail.com'] },
    maxRegistrationsPerDay: { type: Number, default: 500 },
    inviteCodes: [String],
  },

  trial: {
    enabled: { type: Boolean, default: true },
    defaultPlanSlug: { type: String, default: 'growth' },
    days: { type: Number, default: 14 },
    oneTrialPerEmailDomain: { type: Boolean, default: false },
  },

  subscription: {
    graceDays: { type: Number, default: 7 },
    /** What happens after grace ends: read_only keeps viewing/exports, blocked shows renewal only. */
    afterGrace: { type: String, enum: ['read_only', 'blocked'], default: 'read_only' },
    allowExportWhenExpired: { type: Boolean, default: true },
    expiryWarningDays: { type: Number, default: 7 },
  },

  password: {
    minLength: { type: Number, default: 8 },
    requireUppercase: { type: Boolean, default: true },
    requireNumber: { type: Boolean, default: true },
    requireSymbol: { type: Boolean, default: false },
  },

  session: {
    accessTokenMinutes: { type: Number, default: 15 },
    refreshTokenDays: { type: Number, default: 7 },
    maxFailedLogins: { type: Number, default: 5 },
    lockMinutes: { type: Number, default: 15 },
  },

  rateLimit: {
    windowMinutes: { type: Number, default: 15 },
    maxRequests: { type: Number, default: 1000 },
    authMaxRequests: { type: Number, default: 30 },
  },

  uploads: {
    maxFileSizeMB: { type: Number, default: 10 },
    allowedTypes: { type: [String], default: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] },
  },

  dataRetention: {
    softDeletePurgeDays: { type: Number, default: 90 },
    auditLogRetentionDays: { type: Number, default: 730 },
    neverAutoDeleteOnExpiry: { type: Boolean, default: true },
  },

  notifications: {
    emailEnabled: { type: Boolean, default: true },
    whatsappEnabled: { type: Boolean, default: false },
    smsEnabled: { type: Boolean, default: false },
  },

  maintenance: {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: 'GO SOFT is undergoing scheduled maintenance. We will be back shortly.' },
  },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const PlatformPolicy = mongoose.model('PlatformPolicy', platformPolicySchema);
