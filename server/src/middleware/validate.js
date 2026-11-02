import { ApiError } from '../utils/ApiError.js';

/** validate({ body, query, params }) with Zod schemas; replaces values with parsed (stripped) data. */
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const fields = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest(fields[0]?.message ? `${fields[0].field ? fields[0].field + ': ' : ''}${fields[0].message}` : 'Invalid input', { fields }));
    }
    if (part === 'query') Object.defineProperty(req, 'query', { value: result.data, writable: true });
    else req[part] = result.data;
  }
  next();
};
