const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  // Prevent CSV/Excel formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function toCsv(rows, columns) {
  const head = columns.map(([h]) => esc(h)).join(',');
  const body = rows.map((r) => columns.map(([, fn]) => esc(typeof fn === 'function' ? fn(r) : r[fn])).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}
