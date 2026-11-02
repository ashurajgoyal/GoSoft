import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  type: { type: String, enum: ['contact', 'demo'], default: 'contact' },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: String,
  company: String,
  employees: String,
  message: { type: String, maxlength: 2000 },
  source: String,
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'closed'], default: 'new' },
}, { timestamps: true });

export const Lead = mongoose.model('Lead', leadSchema);
