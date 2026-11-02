import { Router } from 'express';
import mongoose from 'mongoose';
import { guard } from '../middleware/tenant.js';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate, pageMeta, escapeRegex } from '../utils/pagination.js';
import { audit } from './audit.js';
import { toCsv } from '../utils/csv.js';

const PROTECTED = ['_id', 'company', 'deletedAt', 'createdAt', 'updatedAt', '__v'];
const clean = (body, fields) => {
  const out = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (PROTECTED.includes(k)) continue;
    if (fields && !fields.includes(k)) continue;
    out[k] = v === '' ? undefined : v;
  }
  return out;
};

/**
 * Tenant-scoped CRUD router. Every route is guarded by the policy engine and every query is built
 * from req.tenantId (plus an ownership filter when the caller's scope is narrower than company).
 *
 * opts: { perm: 'billing.customer', search: [...], fields: [...], populate, sort,
 *         ownFilter(req) → extra filter for own/assigned/team scope,
 *         limit: { name, count(req) }, beforeSave(req, data, existing), afterSave(req, doc, isNew),
 *         csv: [[header, (doc) => value], ...], filters: ['status', ...] }
 */
export function crudRouter(Model, opts) {
  const r = Router();
  const { perm, search = ['name'], fields, populate, sort = { createdAt: -1 }, filters = [] } = opts;
  const name = Model.modelName;

  const baseFilter = (req) => {
    const f = { company: req.tenantId };
    if (opts.ownFilter && req.scope && !['company', 'department'].includes(req.scope)) Object.assign(f, opts.ownFilter(req));
    return f;
  };
  const build = (req) => {
    const f = baseFilter(req);
    if (req.query.q && search.length) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
      // Combine with $and so a search can never widen an ownership ($or) scope filter.
      const searchOr = search.map((s) => ({ [s]: rx }));
      f.$and = [...(f.$and || []), { $or: searchOr }];
    }
    for (const k of filters) {
      const v = req.query[k];
      if (v && v !== 'all' && typeof v === 'string') f[k] = mongoose.isValidObjectId(v) && v.length === 24 ? new mongoose.Types.ObjectId(v) : v;
    }
    if (req.query.from || req.query.to) {
      const dateField = opts.dateField || 'createdAt';
      f[dateField] = {};
      if (req.query.from) f[dateField].$gte = new Date(req.query.from);
      if (req.query.to) f[dateField].$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    return f;
  };
  // Populated refs are tenant data too: always constrain them to the caller's company.
  const withPop = (q, req) => (populate
    ? [].concat(populate).map((p) => (typeof p === 'string' ? { path: p } : p))
      .reduce((acc, p) => acc.populate({ ...p, match: { ...(p.match || {}), company: req.tenantId } }), q)
    : q);

  r.get('/', guard({ permission: `${perm}.view` }), h(async (req, res) => {
    const { page, limit, skip } = paginate(req.query, { maxLimit: 500 });
    const filter = build(req);
    const [items, total] = await Promise.all([withPop(Model.find(filter).sort(sort).skip(skip).limit(limit), req).lean(), Model.countDocuments(filter)]);
    res.json({ success: true, data: opts.transformOut ? items.map((d) => opts.transformOut(d, req)) : items, meta: pageMeta(total, { page, limit }) });
  }));

  if (opts.csv) {
    r.get('/export.csv', guard({ permission: `${perm}.${opts.exportAction || 'export'}`, export: true }), h(async (req, res) => {
      const items = await withPop(Model.find(build(req)).sort(sort).limit(10000), req).lean();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name.toLowerCase()}s.csv"`);
      res.send(toCsv(items, opts.csv));
    }));
  }

  r.get('/:id', guard({ permission: `${perm}.view` }), h(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid id');
    const doc = await withPop(Model.findOne({ ...baseFilter(req), _id: req.params.id }), req).lean();
    if (!doc) throw ApiError.notFound(`${name} not found`);
    res.json({ success: true, data: opts.transformOut ? opts.transformOut(doc, req) : doc });
  }));

  if (opts.create !== false) {
    r.post('/', guard({ permission: `${perm}.create`, write: true, limit: opts.limit }), h(async (req, res) => {
      let data = clean(req.body, fields);
      if (opts.beforeSave) data = (await opts.beforeSave(req, data, null)) || data;
      const doc = await Model.create({ ...data, company: req.tenantId });
      if (opts.afterSave) await opts.afterSave(req, doc, true);
      audit(req, `${name.toLowerCase()}.create`, { targetType: name, targetId: doc._id, summary: doc.name || doc.title || doc.number });
      res.status(201).json({ success: true, data: opts.transformOut ? opts.transformOut(doc.toObject(), req) : doc });
    }));
  }

  r.patch('/:id', guard({ permission: `${perm}.edit`, write: true }), h(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid id');
    const doc = await Model.findOne({ ...baseFilter(req), _id: req.params.id });
    if (!doc) throw ApiError.notFound(`${name} not found`);
    let data = clean(req.body, fields);
    if (opts.beforeSave) data = (await opts.beforeSave(req, data, doc)) || data;
    doc.set(data);
    await doc.save();
    if (opts.afterSave) await opts.afterSave(req, doc, false);
    audit(req, `${name.toLowerCase()}.update`, { targetType: name, targetId: doc._id, summary: doc.name || doc.title || doc.number });
    res.json({ success: true, data: opts.transformOut ? opts.transformOut(doc.toObject(), req) : doc });
  }));

  if (opts.remove !== false) {
    r.delete('/:id', guard({ permission: `${perm}.delete`, write: true }), h(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid id');
      const doc = await Model.findOne({ ...baseFilter(req), _id: req.params.id });
      if (!doc) throw ApiError.notFound(`${name} not found`);
      if (opts.beforeDelete) await opts.beforeDelete(req, doc);
      await doc.softDelete();
      audit(req, `${name.toLowerCase()}.delete`, { targetType: name, targetId: doc._id, summary: doc.name || doc.title || doc.number });
      res.json({ success: true });
    }));
  }
  return r;
}
