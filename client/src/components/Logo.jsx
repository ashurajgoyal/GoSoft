import { Link } from 'react-router-dom';

export function LogoMark({ size = 36, className = '' }) {
  const id = `gs-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B1B3F" />
          <stop offset=".55" stopColor="#1E4FD8" />
          <stop offset="1" stopColor="#2F8CFF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M44 22.5A15 15 0 1 0 47 34H33" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41 15l7 1-1 7" fill="none" stroke="#7FD1FF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = '/', light = false, size = 36, showTagline = false }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="GO SOFT home">
      <LogoMark size={size} className="transition-transform group-hover:rotate-[-6deg]" />
      <span className="leading-none">
        <span className={`font-display text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy-900 dark:text-white'}`}>
          GO<span className="text-royal-600 dark:text-electric-400"> SOFT</span>
        </span>
        {showTagline && <span className={`mt-1 block text-[10px] font-medium uppercase tracking-[.18em] ${light ? 'text-white/60' : 'text-slate-500'}`}>Powered by Goyals Group</span>}
      </span>
    </Link>
  );
}
