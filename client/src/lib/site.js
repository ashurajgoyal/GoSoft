import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const FALLBACK_CONTACT = { phone: '9799289697', whatsapp: '919799289697', email: 'support@gosoft.in', address: 'GoSoft, Near Hyatt Regency, Mansarovar, Jaipur 302020', hours: 'Mon–Sat, 10:00 AM – 7:00 PM IST' };

/** Public website content managed from Super Admin → Website CMS. */
export function useSite() {
  const { data } = useQuery({ queryKey: ['public-site'], queryFn: () => api('/public/site').then((r) => r.data), staleTime: 5 * 60_000 });
  const site = data || {};
  return { ...site, contact: { ...FALLBACK_CONTACT, ...Object.fromEntries(Object.entries(site.contact || {}).filter(([, v]) => v)) }, loaded: !!data };
}
