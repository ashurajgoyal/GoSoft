export const inr = (n, opts = {}) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, ...opts }).format(n);
export const num = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN').format(n));
export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const limitLabel = (n) => (n === -1 ? 'Unlimited' : num(n));
export const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const titleCase = (s = '') => s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
