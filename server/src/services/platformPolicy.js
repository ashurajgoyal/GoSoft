import { PlatformPolicy } from '../models/index.js';

let cache = null;
let cachedAt = 0;
const TTL = 30_000;

/** Returns the platform policy as a plain object (30s in-memory cache). */
export async function getPlatformPolicy({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL) return cache;
  let doc = await PlatformPolicy.findOne({ key: 'platform' }).lean();
  if (!doc) doc = (await PlatformPolicy.create({ key: 'platform' })).toObject();
  cache = doc;
  cachedAt = Date.now();
  return doc;
}

export function invalidatePlatformPolicy() { cache = null; }
