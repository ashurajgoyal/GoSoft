import { create } from 'zustand';

/** Access token lives only in memory; the refresh token is an httpOnly cookie the JS can't read. */
export const useAuth = create((set) => ({
  accessToken: null,
  session: null,
  ready: false,
  setAuth: ({ accessToken, session }) => set((s) => ({ accessToken: accessToken ?? s.accessToken, session: session ?? s.session })),
  setSession: (session) => set({ session }),
  clear: () => set({ accessToken: null, session: null }),
  setReady: () => set({ ready: true }),
}));
