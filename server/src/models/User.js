import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, select: false },
  isSuperAdmin: { type: Boolean, default: false },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  department: { type: String, trim: true },
  designation: { type: String, trim: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  status: { type: String, enum: ['invited', 'active', 'inactive'], default: 'active', index: true },
  emailVerified: { type: Boolean, default: false },
  emailVerifyTokenHash: { type: String, select: false },
  emailVerifyExpires: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  /** Incremented to invalidate all access tokens (logout everywhere, password change, deactivation). */
  tokenVersion: { type: Number, default: 0 },
  failedLogins: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, select: false },
  lastLoginAt: Date,
  passwordChangedAt: Date,
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
  this.passwordChangedAt = new Date();
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const o = this.toObject({ virtuals: false });
  for (const k of ['passwordHash', 'emailVerifyTokenHash', 'emailVerifyExpires', 'passwordResetTokenHash',
    'passwordResetExpires', 'failedLogins', 'lockUntil', 'tokenVersion', '__v']) delete o[k];
  return o;
};

export const User = mongoose.model('User', userSchema);
