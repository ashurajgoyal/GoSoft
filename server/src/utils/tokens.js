import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(user, minutes = 15) {
  return jwt.sign(
    { sub: String(user._id), cid: user.company ? String(user.company) : null, sa: !!user.isSuperAdmin, tv: user.tokenVersion || 0 },
    env.jwtAccessSecret,
    { expiresIn: `${minutes}m`, issuer: 'gosoft' },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, { issuer: 'gosoft' });
}

/** Opaque random token (refresh / email verification / password reset). Only the hash is stored. */
export function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token) {
  return crypto.createHmac('sha256', env.jwtRefreshSecret).update(token).digest('hex');
}
