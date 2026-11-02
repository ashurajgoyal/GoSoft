import mongoose from 'mongoose';
import { tenantScoped } from './plugins/tenantScoped.js';
import { SCOPES } from '../policy/permissions.js';

const permissionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  scope: { type: String, enum: SCOPES, default: 'company' },
}, { _id: false });

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  slug: { type: String, required: true },
  description: { type: String, maxlength: 240 },
  isSystem: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  permissions: [permissionSchema],
}, { timestamps: true });

roleSchema.plugin(tenantScoped);
roleSchema.index({ company: 1, slug: 1 }, { unique: true });

export const Role = mongoose.model('Role', roleSchema);
