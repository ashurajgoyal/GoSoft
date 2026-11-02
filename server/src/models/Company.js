import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  line1: String, line2: String, city: String, state: String, stateCode: String, pincode: String,
  country: { type: String, default: 'India' },
}, { _id: false });

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  businessType: {
    type: String,
    enum: ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'opc', 'other'],
    default: 'proprietorship',
  },
  industry: { type: String, trim: true },
  gstin: { type: String, uppercase: true, trim: true },
  pan: { type: String, uppercase: true, trim: true },
  address: addressSchema,
  logoUrl: String,

  status: { type: String, enum: ['pending', 'active', 'suspended', 'blocked'], default: 'active', index: true },
  suspension: {
    category: { type: String, enum: ['payment', 'abuse', 'security', 'terms', 'fraud', 'administrative'] },
    reason: String,
    at: Date,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  /** Per-company overrides of plan limits set by Super Admin (null = use plan). */
  limitOverrides: {
    users: { type: Number, default: null },
    employees: { type: Number, default: null },
    invoicesPerMonth: { type: Number, default: null },
    storageMB: { type: Number, default: null },
  },

  settings: {
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
  },

  /** Module settings (Phase 2–4). Mixed so statutory rules can evolve without migrations. */
  billingSettings: {
    invoicePrefix: { type: String, default: 'INV' }, proformaPrefix: { type: String, default: 'PRO' },
    creditNotePrefix: { type: String, default: 'CN' }, debitNotePrefix: { type: String, default: 'DN' }, receiptPrefix: { type: String, default: 'RCPT' },
    defaultTerms: { type: String, default: 'Payment due within 15 days. Thank you for your business.' },
    bankDetails: String, upiId: String, signatory: String, defaultDueDays: { type: Number, default: 15 },
  },
  hrSettings: {
    shiftStart: { type: String, default: '09:30' }, shiftEnd: { type: String, default: '18:30' },
    graceMinutes: { type: Number, default: 15 }, fullDayHours: { type: Number, default: 8 }, halfDayHours: { type: Number, default: 4 },
    weeklyOffs: { type: [Number], default: [0] }, employeeIdPrefix: { type: String, default: 'EMP' },
  },
  payrollSettings: { type: mongoose.Schema.Types.Mixed, default: {} },
  usage: {
    storageMB: { type: Number, default: 0 },
  },
  lastActivityAt: Date,
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

companySchema.index({ name: 'text', email: 'text' });
companySchema.index({ createdAt: -1 });

export const Company = mongoose.model('Company', companySchema);
