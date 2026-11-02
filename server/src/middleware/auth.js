import { User } from '../models/index.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Authentication middleware — verifies the Bearer access token and loads a fresh user. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (e) {
    throw new ApiError(401, e.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token',
      e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.sub).lean();
  if (!user || user.deletedAt) throw ApiError.unauthorized('Account not found');
  if ((user.tokenVersion || 0) !== payload.tv) throw new ApiError(401, 'Session revoked, please log in again', 'TOKEN_REVOKED');
  if (user.status !== 'active') throw ApiError.forbidden('Your account is not active', 'ACCOUNT_INACTIVE');

  req.user = user;
  next();
});

/** Super Admin gate for /api/v1/admin. */
export const requireSuperAdmin = (req, _res, next) => {
  if (!req.user?.isSuperAdmin) return next(ApiError.forbidden('Super Admin access required', 'SUPER_ADMIN_ONLY'));
  next();
};
