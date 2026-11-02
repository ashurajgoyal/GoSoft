import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  tagline: String,
  description: String,
  priceMonthly: { type: Number, required: true, min: 0 },   // INR, excluding GST
  priceAnnual: { type: Number, required: true, min: 0 },    // INR per year, excluding GST
  currency: { type: String, default: 'INR' },
  trialDays: { type: Number, default: 14, min: 0 },
  limits: {
    users: { type: Number, default: 5 },           // -1 = unlimited
    employees: { type: Number, default: 10 },
    invoicesPerMonth: { type: Number, default: 100 },
    storageMB: { type: Number, default: 1024 },
    branches: { type: Number, default: 1 },
  },
  modules: [{ type: String }],                     // keys of MODULES
  features: [{ type: String }],                    // marketing bullet points
  highlighted: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false, index: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export const Plan = mongoose.model('Plan', planSchema);
