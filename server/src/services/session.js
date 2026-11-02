import { RefreshToken } from '../models/index.js';
import { randomToken, hashToken, signAccessToken } from '../utils/tokens.js';
import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'gs_rt';
const DAY = 24 * 60 * 60 * 1000;

const cookieOpts = (days) => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'strict' : 'lax', // strict same-site cookie = CSRF protection for the refresh endpoint
  path: '/api/v1/auth',
  maxAge: days * DAY,
});

export async function issueSession(req, res, user, platform, family = randomToken(12)) {
  const days = platform.session?.refreshTokenDays ?? 7;
  const refresh = randomToken();
  await RefreshToken.create({
    user: user._id, tokenHash: hashToken(refresh), family,
    expiresAt: new Date(Date.now() + days * DAY), ip: req.ip, userAgent: req.get('user-agent'),
  });
  res.cookie(REFRESH_COOKIE, refresh, cookieOpts(days));
  return { accessToken: signAccessToken(user, platform.session?.accessTokenMinutes ?? 15), refresh };
}

export function clearSessionCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts(0), maxAge: undefined });
}
