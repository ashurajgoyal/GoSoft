import crypto from 'node:crypto';
import { env } from '../config/env.js';

// AES-256-GCM helpers for sensitive fields (bank details, PAN, salary data in later phases).
const key = () => {
  const hex = env.encryptionKey || '';
  if (hex.length !== 64) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return Buffer.from(hex, 'hex');
};

export function encrypt(plain) {
  if (plain == null || plain === '') return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload) {
  if (!payload || !String(payload).startsWith('v1:')) return payload;
  try {
    const [, iv, tag, data] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    console.error('[crypto] could not decrypt a value — wrong DATA_ENCRYPTION_KEY or corrupted data');
    return '';
  }
}
