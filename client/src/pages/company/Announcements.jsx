import ResourcePage from '../../components/ResourcePage';
import { Badge } from '../../components/ui';
import { date } from '../../lib/format';

export default function Announcements() {
  return <ResourcePage title="Announcements" singular="announcement" endpoint="/company/announcements" perm="core.announcement" description="Everyone in the company is notified when you post."
    columns={[{ label: 'Title', render: (a) => <><p className="font-medium">{a.pinned && '📌 '}{a.title}</p><p className="max-w-md truncate text-xs text-slate-500">{a.body}</p></> }, { label: 'Posted', render: (a) => date(a.createdAt) },
      { label: 'Expires', render: (a) => (a.expiresAt ? date(a.expiresAt) : <Badge>Never</Badge>) }]}
    fields={[{ name: 'title', label: 'Title', required: true, full: true }, { name: 'body', label: 'Message', type: 'textarea' }, { name: 'pinned', label: 'Pin to top', type: 'checkbox' }, { name: 'expiresAt', label: 'Expires on', type: 'date' }]} />;
}
