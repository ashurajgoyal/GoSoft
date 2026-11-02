import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../store/theme';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} aria-label="Toggle dark mode"
      className={`rounded-xl p-2 text-slate-500 transition hover:bg-soft-100 hover:text-navy-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white ${className}`}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
