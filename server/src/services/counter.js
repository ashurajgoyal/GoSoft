import { Counter, PlatformCounter } from '../models/index.js';

/** Atomic per-company sequence (e.g. invoice numbers per type per financial year). */
export async function nextSeq(companyId, key) {
  const c = await Counter.findOneAndUpdate({ company: companyId, key }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return c.seq;
}
export async function nextPlatformSeq(key) {
  const c = await PlatformCounter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}
