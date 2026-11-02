import mongoose from 'mongoose';

/**
 * Tenant isolation guard.
 * - Adds a required, indexed `company` field.
 * - Every query on the model MUST filter by `company`, otherwise it throws.
 *   Platform-level code (Super Admin) must opt out explicitly with `.setOptions({ platformScope: true })`.
 * - Adds soft deletion (`deletedAt`) and hides soft-deleted docs by default.
 *
 * This is a second line of defence: controllers always build queries from `req.tenantId`,
 * and this plugin makes a forgotten filter fail loudly instead of leaking other tenants' data.
 */
const QUERY_OPS = ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'countDocuments',
  'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'];

export function tenantScoped(schema) {
  schema.add({
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    deletedAt: { type: Date, default: null },
  });

  for (const op of QUERY_OPS) {
    schema.pre(op, function guard() {
      const opts = this.getOptions();
      const filter = this.getFilter();
      if (!opts.platformScope && !filter.company) {
        throw new Error(`[tenant-guard] ${this.model.modelName}.${op} executed without a company filter`);
      }
      if (!opts.withDeleted && filter.deletedAt === undefined) this.where({ deletedAt: null });
    });
  }

  schema.pre('aggregate', function guard() {
    const first = this.pipeline()[0];
    if (!this.options.platformScope && !(first && first.$match && first.$match.company)) {
      throw new Error(`[tenant-guard] ${this._model.modelName}.aggregate must start with $match on company`);
    }
  });

  schema.methods.softDelete = function softDelete() {
    this.deletedAt = new Date();
    return this.save();
  };
}
