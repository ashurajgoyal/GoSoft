import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useApiQuery, useApiMutation } from '../lib/hooks';
import { dateTime } from '../lib/format';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useApiQuery('notifications', '/company/notifications', undefined, { refetchInterval: 60_000, retry: false });
  const read = useApiMutation({ path: '/company/notifications/read', invalidate: ['notifications'] });
  const items = data?.data || [];
  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open && data?.unread) read.mutate({ body: {} }); }} className="relative rounded-xl p-2 text-slate-500 hover:bg-soft-100 dark:hover:bg-white/10" aria-label="Notifications">
        <Bell className="h-5 w-5" />{data?.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="card absolute right-0 z-40 mt-2 w-80 overflow-hidden shadow-xl">
          <p className="border-b border-soft-200 px-4 py-3 text-sm font-bold dark:border-white/10">Notifications</p>
          <div className="max-h-96 overflow-y-auto">{items.length ? items.map((n) => (
            <Link key={n._id} to={n.link || '#'} onClick={() => setOpen(false)} className="block border-b border-soft-200 px-4 py-3 text-sm hover:bg-soft-50 dark:border-white/10 dark:hover:bg-white/5">
              <p className={n.readAt ? '' : 'font-semibold'}>{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}<p className="mt-1 text-[11px] text-slate-400">{dateTime(n.createdAt)}</p></Link>
          )) : <p className="p-6 text-center text-sm text-slate-500">You're all caught up.</p>}</div>
        </div>
      </>)}
    </div>
  );
}
