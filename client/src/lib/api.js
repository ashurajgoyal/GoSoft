import { useAuth } from '../store/auth';

const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

let refreshing = null;

/** Single-flight refresh: concurrent 401s share one refresh request. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new ApiError(r.status, body);
        useAuth.getState().setAuth(body.data);
        return body.data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, { method = 'GET', body, query, retry = true } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '' && v !== null) url.searchParams.set(k, v);

  const token = useAuth.getState().accessToken;
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && retry && ['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED'].includes(data?.error?.code) && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      return api(path, { method, body, query, retry: false });
    } catch {
      useAuth.getState().clear();
    }
  }
  if (res.status === 401 && data?.error?.code === 'TOKEN_REVOKED') useAuth.getState().clear();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const get = (p, query) => api(p, { query }).then((r) => r);
export const post = (p, body) => api(p, { method: 'POST', body });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p) => api(p, { method: 'DELETE' });
