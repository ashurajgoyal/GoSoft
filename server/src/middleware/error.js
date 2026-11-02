import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let e = err;
  if (err?.name === 'CastError') e = ApiError.badRequest('Invalid identifier');
  else if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    e = ApiError.conflict(`That ${field} is already in use`);
  } else if (err?.name === 'ValidationError') {
    e = ApiError.badRequest(Object.values(err.errors)[0]?.message || 'Validation failed');
  } else if (err?.type === 'entity.parse.failed') e = ApiError.badRequest('Malformed JSON body');

  if (!(e instanceof ApiError)) {
    console.error('[error]', err);
    e = new ApiError(500, env.isProd ? 'Something went wrong' : err.message, 'INTERNAL');
  }
  res.status(e.status).json({ success: false, error: { code: e.code, message: e.message, details: e.details } });
}
