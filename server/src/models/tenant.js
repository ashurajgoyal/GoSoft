import mongoose from 'mongoose';
import { tenantScoped } from './plugins/tenantScoped.js';
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const model = (name, def, opts = {}, indexes = []) => {
  const s = new Schema(def, { timestamps: true, ...opts });
  s.plugin(tenantScoped);
  indexes.forEach((i) => s.index(...i));
  return mongoose.model(name, s);
};
const address = { line1: String, line2: String, city: String, state: String, stateCode: String, pincode: String, country: { type: String, default: 'India' } };

/* --------------------------------- Billing -------------------------------- */
export const Customer = model('Customer', {
  name: { type: String, required: true, trim: true }, contactPerson: String, email: String, phone: String,
  gstin: { type: String, uppercase: true }, pan: String, billingAddress: address, shippingAddress: address,
  stateCode: String, openingBalance: { type: Number, default: 0 }, creditDays: { type: Number, default: 0 }, notes: String,
}, {}, [[{ company: 1, name: 1 }]]);

export const Vendor = model('Vendor', {
  name: { type: String, required: true, trim: true }, contactPerson: String, email: String, phone: String,
  gstin: { type: String, uppercase: true }, address, stateCode: String, notes: String,
});

export const Product = model('Product', {
  name: { type: String, required: true, trim: true }, type: { type: String, enum: ['goods', 'service'], default: 'goods' },
  sku: String, hsnSac: String, unit: { type: String, default: 'NOS' }, rate: { type: Number, default: 0 },
  taxRate: { type: Number, default: 18, enum: [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28] }, taxInclusive: { type: Boolean, default: false },
  description: String, active: { type: Boolean, default: true },
});

export const Expense = model('Expense', {
  date: { type: Date, required: true, default: Date.now }, category: { type: String, required: true }, vendor: { type: ObjectId, ref: 'Vendor' },
  description: String, amount: { type: Number, required: true, min: 0 }, gstAmount: { type: Number, default: 0 },
  paymentMode: { type: String, enum: ['cash', 'bank', 'upi', 'card', 'cheque', 'other'], default: 'bank' }, reference: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }, createdBy: { type: ObjectId, ref: 'User' },
});

const lineSchema = new Schema({
  product: { type: ObjectId, ref: 'Product' }, description: { type: String, required: true }, hsnSac: String, unit: String,
  quantity: Number, rate: Number, discountPercent: Number, taxRate: Number, discount: Number, taxableValue: Number,
  cgst: Number, sgst: Number, igst: Number, total: Number,
}, { _id: false });

export const Invoice = model('Invoice', {
  type: { type: String, enum: ['invoice', 'proforma', 'credit_note', 'debit_note'], default: 'invoice', index: true },
  number: { type: String, required: true }, financialYear: String,
  date: { type: Date, required: true, default: Date.now }, dueDate: Date,
  customer: { type: ObjectId, ref: 'Customer', required: true },
  customerSnapshot: { name: String, gstin: String, address: String, stateCode: String, email: String, phone: String },
  placeOfSupply: String, supplierStateCode: String, taxInclusive: { type: Boolean, default: false },
  items: [lineSchema], interState: Boolean,
  subtotal: Number, cgst: Number, sgst: Number, igst: Number, totalTax: Number, discountTotal: Number, roundOff: Number, grandTotal: Number,
  taxSummary: [{ _id: false, taxRate: Number, taxableValue: Number, cgst: Number, sgst: Number, igst: Number }],
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'], default: 'issued', index: true },
  referenceInvoice: { type: ObjectId, ref: 'Invoice' }, notes: String, terms: String, createdBy: { type: ObjectId, ref: 'User' },
}, {}, [[{ company: 1, type: 1, number: 1 }, { unique: true }], [{ company: 1, date: -1 }]]);

export const Receipt = model('Receipt', {
  number: String, date: { type: Date, default: Date.now }, customer: { type: ObjectId, ref: 'Customer', required: true },
  invoice: { type: ObjectId, ref: 'Invoice' }, amount: { type: Number, required: true, min: 0.01 },
  mode: { type: String, enum: ['cash', 'bank', 'upi', 'card', 'cheque', 'other'], default: 'bank' }, reference: String, notes: String,
  createdBy: { type: ObjectId, ref: 'User' },
});

export const Counter = model('Counter', { key: { type: String, required: true }, seq: { type: Number, default: 0 } }, {}, [[{ company: 1, key: 1 }, { unique: true }]]);

/* ---------------------------------- HRMS ---------------------------------- */
export const Department = model('Department', { name: { type: String, required: true, trim: true }, head: { type: ObjectId, ref: 'Employee' }, description: String });

export const Employee = model('Employee', {
  employeeId: { type: String, required: true }, user: { type: ObjectId, ref: 'User' },
  firstName: { type: String, required: true, trim: true }, lastName: { type: String, trim: true },
  email: String, phone: String, gender: { type: String, enum: ['male', 'female', 'other', ''] }, dateOfBirth: Date,
  department: { type: ObjectId, ref: 'Department' }, designation: String, joiningDate: { type: Date, default: Date.now },
  reportingManager: { type: ObjectId, ref: 'Employee' },
  employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
  status: { type: String, enum: ['active', 'on_notice', 'exited'], default: 'active', index: true }, exitDate: Date,
  address, emergencyContact: { name: String, relation: String, phone: String },
  bank: { accountName: String, accountNumberEnc: String, ifsc: String, bankName: String }, panEnc: String, uan: String, esicNumber: String,
  salary: {
    basic: { type: Number, default: 0 }, hra: { type: Number, default: 0 }, allowances: [{ _id: false, name: String, amount: Number }],
    tdsMonthly: { type: Number, default: 0 }, pfApplicable: { type: Boolean, default: true }, esiApplicable: { type: Boolean, default: true }, ptApplicable: { type: Boolean, default: true },
  },
  documents: [{ name: String, url: String, uploadedAt: { type: Date, default: Date.now } }],
}, {}, [[{ company: 1, employeeId: 1 }, { unique: true }], [{ company: 1, user: 1 }]]);

export const Attendance = model('Attendance', {
  employee: { type: ObjectId, ref: 'Employee', required: true }, date: { type: String, required: true }, // YYYY-MM-DD
  checkIn: Date, checkOut: Date, breaks: [{ _id: false, start: Date, end: Date }],
  workMinutes: { type: Number, default: 0 }, breakMinutes: { type: Number, default: 0 }, overtimeMinutes: { type: Number, default: 0 },
  lateMinutes: { type: Number, default: 0 }, earlyLeaveMinutes: { type: Number, default: 0 },
  status: { type: String, enum: ['present', 'half_day', 'absent', 'on_leave', 'holiday'], default: 'present' },
  correction: { requested: Boolean, checkIn: Date, checkOut: Date, reason: String, status: { type: String, enum: ['pending', 'approved', 'rejected'] }, reviewedBy: { type: ObjectId, ref: 'User' } },
  source: { type: String, default: 'web' }, notes: String,
}, {}, [[{ company: 1, employee: 1, date: 1 }, { unique: true }]]);

export const LeaveType = model('LeaveType', {
  name: { type: String, required: true }, code: String, annualQuota: { type: Number, default: 12 }, paid: { type: Boolean, default: true },
  carryForward: { type: Boolean, default: false }, color: { type: String, default: '#1E4FD8' }, active: { type: Boolean, default: true },
});

export const LeaveRequest = model('LeaveRequest', {
  employee: { type: ObjectId, ref: 'Employee', required: true }, leaveType: { type: ObjectId, ref: 'LeaveType', required: true },
  from: { type: Date, required: true }, to: { type: Date, required: true }, halfDay: { type: Boolean, default: false }, days: Number,
  reason: String, status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  reviewedBy: { type: ObjectId, ref: 'User' }, reviewNote: String, reviewedAt: Date,
});

export const Holiday = model('Holiday', { name: { type: String, required: true }, date: { type: Date, required: true }, optional: { type: Boolean, default: false } });

/* --------------------------------- Payroll -------------------------------- */
export const PayrollRun = model('PayrollRun', {
  month: { type: Number, required: true, min: 1, max: 12 }, year: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  totals: { gross: Number, deductions: Number, net: Number, employerCost: Number, employees: Number },
  approvedBy: { type: ObjectId, ref: 'User' }, approvedAt: Date, paidAt: Date, createdBy: { type: ObjectId, ref: 'User' },
}, {}, [[{ company: 1, year: 1, month: 1 }, { unique: true }]]);

export const Payslip = model('Payslip', {
  run: { type: ObjectId, ref: 'PayrollRun', required: true, index: true }, employee: { type: ObjectId, ref: 'Employee', required: true },
  month: Number, year: Number, employeeSnapshot: { name: String, employeeId: String, designation: String, department: String, uan: String, bankAccount: String },
  inputs: { totalDays: Number, paidDays: Number, overtimeHours: Number, bonus: Number, incentive: Number, advanceRecovery: Number, otherDeductions: Number },
  earnings: [{ _id: false, name: String, amount: Number }], deductions: [{ _id: false, name: String, amount: Number }],
  gross: Number, totalDeductions: Number, netPay: Number, lopDays: Number, employer: { pf: Number, esi: Number }, ctcMonthly: Number,
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
});

/* ------------------------------ Tasks/Projects ---------------------------- */
export const Project = model('Project', {
  name: { type: String, required: true, trim: true }, code: String, description: String, client: { type: ObjectId, ref: 'Customer' },
  manager: { type: ObjectId, ref: 'User' }, members: [{ type: ObjectId, ref: 'User' }],
  startDate: Date, deadline: Date, priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'active' },
  progress: { type: Number, default: 0 }, attachments: [{ name: String, url: String }], createdBy: { type: ObjectId, ref: 'User' },
});

export const Task = model('Task', {
  title: { type: String, required: true, trim: true }, description: String, project: { type: ObjectId, ref: 'Project' },
  assignees: [{ type: ObjectId, ref: 'User' }], createdBy: { type: ObjectId, ref: 'User' }, approver: { type: ObjectId, ref: 'User' },
  status: { type: String, enum: ['todo', 'in_progress', 'review', 'completed', 'on_hold'], default: 'todo', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  startDate: Date, dueDate: Date, reminderAt: Date, completedAt: Date, order: { type: Number, default: 0 },
  checklist: [{ text: String, done: { type: Boolean, default: false } }],
  comments: [{ user: { type: ObjectId, ref: 'User' }, userName: String, text: String, at: { type: Date, default: Date.now } }],
  attachments: [{ name: String, url: String }],
  history: [{ _id: false, at: { type: Date, default: Date.now }, user: String, change: String }],
}, {}, [[{ company: 1, assignees: 1 }], [{ company: 1, project: 1 }]]);

/* -------------------------- Announcements & notifications ----------------- */
export const Announcement = model('Announcement', {
  title: { type: String, required: true }, body: String, pinned: { type: Boolean, default: false }, createdBy: { type: ObjectId, ref: 'User' }, expiresAt: Date,
});

export const Notification = model('Notification', {
  user: { type: ObjectId, ref: 'User', required: true }, title: { type: String, required: true }, body: String, link: String,
  type: { type: String, default: 'info' }, readAt: Date,
}, {}, [[{ company: 1, user: 1, createdAt: -1 }]]);

export const EmployeeRequest = model('EmployeeRequest', {
  employee: { type: ObjectId, ref: 'Employee', required: true }, type: { type: String, enum: ['document', 'salary_advance', 'asset', 'reimbursement', 'other'], default: 'other' },
  subject: { type: String, required: true }, details: String, amount: Number,
  status: { type: String, enum: ['open', 'approved', 'rejected', 'closed'], default: 'open' }, response: String, reviewedBy: { type: ObjectId, ref: 'User' },
});
