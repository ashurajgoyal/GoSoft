import { useAuth } from '../store/auth';

/** UI-only helper to hide controls. The backend enforces every permission independently. */
export function can(session, key) {
  if (!session) return false;
  if (session.user?.isSuperAdmin) return true;
  return (session.permissions || []).some((p) => p === '*' || p.key === key || p.key === '*');
}

export function hasModule(session, module) {
  if (module === 'core') return true;
  return (session?.subscription?.plan?.modules || []).includes(module);
}

export const useCan = () => {
  const session = useAuth((s) => s.session);
  return (key) => can(session, key);
};
