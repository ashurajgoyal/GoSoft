import rateLimit from 'express-rate-limit';

/** Strips keys starting with `$` or containing `.` from user input (NoSQL operator injection). */
export function sanitize(req, _res, next) {
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (k.startsWith('$') || k.includes('.')) delete v[k];
        else v[k] = clean(v[k]);
      }
    }
    return v;
  };
  if (req.body) clean(req.body);
  if (req.params) clean(req.params);
  if (req.query) clean(req.query);
  next();
}

const json = (code, message) => ({ success: false, error: { code, message } });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: 'draft-7', legacyHeaders: false,
  message: json('RATE_LIMITED', 'Too many requests, please slow down.'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
  message: json('RATE_LIMITED', 'Too many attempts. Please try again in a few minutes.'),
});

export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: json('RATE_LIMITED', 'Too many submissions. Please try again later.'),
});
