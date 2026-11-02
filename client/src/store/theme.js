import { create } from 'zustand';

const read = () => { try { return localStorage.getItem('gs-theme') || 'light'; } catch { return 'light'; } };

export const useTheme = create((set) => ({
  theme: read(),
  toggle: () => set((s) => {
    const theme = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('gs-theme', theme); } catch { /* storage unavailable */ }
    return { theme };
  }),
}));
