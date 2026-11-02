import toast from 'react-hot-toast';
import { useAuth } from '../store/auth';
import { refreshSession } from './api';

const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

/** Authenticated file download (CSV exports). */
export async function downloadFile(path, filename) {
  const go = () => fetch(BASE + path, { credentials: 'include', headers: { Authorization: `Bearer ${useAuth.getState().accessToken}` } });
  let res = await go();
  if (res.status === 401) { await refreshSession().catch(() => {}); res = await go(); }
  if (!res.ok) { const b = await res.json().catch(() => ({})); return toast.error(b?.error?.message || 'Download failed'); }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
