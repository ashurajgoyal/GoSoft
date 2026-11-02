import { forwardRef, useEffect } from 'react';
import { Loader2, X, Inbox } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-royal-600 text-white shadow-lg shadow-royal-600/25 hover:bg-royal-700',
  secondary: 'bg-white text-navy-900 border border-soft-200 hover:bg-soft-100 dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-white/10',
  ghost: 'text-slate-600 hover:bg-soft-100 dark:text-slate-300 dark:hover:bg-white/5',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  light: 'bg-white text-navy-900 hover:bg-soft-100',
  outlineLight: 'border border-white/30 text-white hover:bg-white/10',
};
const SIZES = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3.5 text-base' };

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, className, children, icon: Icon, ...props }, ref) {
  return (
    <button ref={ref} disabled={loading || props.disabled} {...props}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60', VARIANTS[variant], SIZES[size], className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
});

export const Input = forwardRef(function Input({ label, error, hint, className, ...props }, ref) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      <input ref={ref} className={cx('input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15')} {...props} />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
});

export const Select = forwardRef(function Select({ label, error, children, className, ...props }, ref) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      <select ref={ref} className="input pr-8" {...props}>{children}</select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});

export function Textarea({ label, className, ...props }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      <textarea className="input min-h-28" {...props} />
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-royal-600' : 'bg-slate-300 dark:bg-white/15')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Card({ className, children, ...props }) {
  return <div className={cx('card', className)} {...props}>{children}</div>;
}

const BADGES = {
  gray: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  blue: 'bg-royal-600/10 text-royal-700 dark:text-electric-300',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
};
export function Badge({ color = 'gray', children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGES[color], className)}>{children}</span>;
}

const STATUS_COLORS = {
  active: 'green', trialing: 'blue', pending: 'amber', invited: 'amber', grace: 'amber', past_due: 'amber',
  suspended: 'red', blocked: 'red', expired: 'red', read_only: 'red', none: 'gray', inactive: 'gray', cancelled: 'gray',
  new: 'blue', contacted: 'violet', qualified: 'green', closed: 'gray',
  paid: 'green', issued: 'blue', partially_paid: 'amber', draft: 'gray', approved: 'green', rejected: 'red', open: 'blue',
  published: 'green', scheduled: 'violet', failed: 'red', refunded: 'violet', partially_refunded: 'violet', created: 'gray',
};
export const StatusBadge = ({ status }) => <Badge color={STATUS_COLORS[status] || 'gray'}>{String(status || '—').replace(/_/g, ' ')}</Badge>;

export function Spinner({ className }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-royal-600', className)} />;
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-royal-600/10 p-4 text-royal-600 dark:text-electric-400"><Icon className="h-7 w-7" /></div>
      <h3 className="text-base font-semibold text-navy-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState icon={X} title="Something went wrong" description={error?.message || 'Please try again.'}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>} />
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/60 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cx('card w-full animate-fade-up', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-soft-200 p-5 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold text-navy-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-soft-100 dark:hover:bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-soft-200 p-4 dark:border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, hint, tone = 'blue' }) {
  const tones = { blue: 'from-royal-600 to-electric-500', green: 'from-emerald-500 to-teal-400', amber: 'from-amber-500 to-orange-400', red: 'from-rose-500 to-red-400', violet: 'from-violet-600 to-fuchsia-500', navy: 'from-navy-800 to-navy-700' };
  return (
    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-navy-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && <div className={cx('rounded-xl bg-gradient-to-br p-2.5 text-white shadow-lg', tones[tone])}><Icon className="h-5 w-5" /></div>}
      </div>
    </Card>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-soft-200 px-4 py-3 text-sm dark:border-white/10">
      <span className="text-slate-500">Page {meta.page} of {meta.pages} · {meta.total} total</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button size="sm" variant="secondary" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Progress({ value, max }) {
  const unlimited = max === -1;
  const pct = unlimited ? 8 : Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-soft-100 dark:bg-white/10">
      <div className={cx('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-royal-600 to-electric-500')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-soft-100 p-1 dark:bg-white/5">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cx('whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition', value === t.value ? 'bg-white text-navy-900 shadow-sm dark:bg-navy-800 dark:text-white' : 'text-slate-500 hover:text-navy-900 dark:hover:text-white')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
