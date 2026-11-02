import mongoose from 'mongoose';
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const credsSchema = new Schema({ appId: String, secretKeyEnc: String, updatedAt: Date }, { _id: false });

/** Super Admin–managed gateway configuration. Secrets are AES-256-GCM encrypted and never returned by the API. */
export const PaymentGateway = mongoose.model('PaymentGateway', new Schema({
  provider: { type: String, default: 'cashfree', unique: true },
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
  sandbox: { type: credsSchema, default: {} },
  production: { type: credsSchema, default: {} },
  gstRate: { type: Number, default: 18 },
  seller: { // printed on platform subscription invoices
    legalName: { type: String, default: 'Goyals Group' },
    gstin: String,
    stateCode: { type: String, default: '08' },
    address: { type: String, default: 'GoSoft, Near Hyatt Regency, Mansarovar, Jaipur 302020' },
    phone: { type: String, default: '9799289697' },
    email: String,
  },
  lastTestedAt: Date,
  lastTestResult: String,
  updatedBy: { type: ObjectId, ref: 'User' },
}, { timestamps: true }));

export const Payment = mongoose.model('Payment', new Schema({
  company: { type: ObjectId, ref: 'Company', required: true, index: true },
  user: { type: ObjectId, ref: 'User' },
  plan: { type: ObjectId, ref: 'Plan', required: true },
  billingCycle: { type: String, enum: ['monthly', 'annual'], required: true },
  purpose: { type: String, enum: ['new', 'renewal', 'upgrade', 'downgrade'], default: 'new' },
  orderId: { type: String, required: true, unique: true },
  cfOrderId: String,
  paymentSessionId: String,
  mode: { type: String, enum: ['sandbox', 'production'] },
  amount: { type: Number, required: true },      // base price
  discount: { type: Number, default: 0 },
  taxableAmount: Number,
  gst: Number,
  total: { type: Number, required: true },       // charged amount
  coupon: { code: String, id: { type: ObjectId, ref: 'Coupon' } },
  status: { type: String, enum: ['created', 'pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded'], default: 'created', index: true },
  cfPaymentId: String,
  paymentMethod: String,
  paidAt: Date,
  failureReason: String,
  processedAt: Date,                              // set once activation ran — idempotency guard
  refunds: [{ refundId: String, amount: Number, status: String, note: String, at: { type: Date, default: Date.now }, by: { type: ObjectId, ref: 'User' } }],
  invoice: { type: ObjectId, ref: 'PlatformInvoice' },
}, { timestamps: true }));

export const PlatformInvoice = mongoose.model('PlatformInvoice', new Schema({
  number: { type: String, required: true, unique: true },
  company: { type: ObjectId, ref: 'Company', required: true, index: true },
  payment: { type: ObjectId, ref: 'Payment' },
  billedTo: { name: String, email: String, gstin: String, address: String, stateCode: String },
  seller: Schema.Types.Mixed,
  description: String,
  periodStart: Date, periodEnd: Date,
  amount: Number, discount: Number, taxableAmount: Number,
  cgst: Number, sgst: Number, igst: Number, total: Number,
  issuedAt: { type: Date, default: Date.now },
}, { timestamps: true }));

export const Coupon = mongoose.model('Coupon', new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: String,
  type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  value: { type: Number, required: true, min: 0 },
  maxDiscount: Number,
  plans: [{ type: ObjectId, ref: 'Plan' }],       // empty = all plans
  billingCycles: { type: [String], default: ['monthly', 'annual'] },
  validFrom: Date, validTo: Date,
  maxRedemptions: Number, redemptions: { type: Number, default: 0 },
  oncePerCompany: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
}, { timestamps: true }));

export const WebhookLog = mongoose.model('WebhookLog', new Schema({
  provider: { type: String, default: 'cashfree' },
  type: String,
  orderId: String,
  signatureValid: Boolean,
  processed: Boolean,
  result: String,
  payload: Schema.Types.Mixed,
  ip: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));

export const PlatformCounter = mongoose.model('PlatformCounter', new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }));
