export function validatePassword(pw = '', policy = {}) {
  const p = { minLength: 8, requireUppercase: true, requireNumber: true, requireSymbol: false, ...policy };
  const errors = [];
  if (pw.length < p.minLength) errors.push(`at least ${p.minLength} characters`);
  if (pw.length > 128) errors.push('at most 128 characters');
  if (p.requireUppercase && !/[A-Z]/.test(pw)) errors.push('an uppercase letter');
  if (p.requireNumber && !/\d/.test(pw)) errors.push('a number');
  if (p.requireSymbol && !/[^A-Za-z0-9]/.test(pw)) errors.push('a symbol');
  return errors.length ? `Password must contain ${errors.join(', ')}.` : null;
}
