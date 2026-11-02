export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, p, v) {
  const keys = p.split('.');
  const out = { ...o };
  let cur = out;
  keys.slice(0, -1).forEach((k) => { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; });
  cur[keys.at(-1)] = v;
  return out;
}
export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
