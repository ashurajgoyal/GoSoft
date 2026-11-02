import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { Card, PageHeader, Select, Pagination, PageLoader, EmptyState, ErrorState, Badge } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { dateTime } from '../../lib/format';

const STATUSES = ['new', 'contacted', 'qualified', 'closed'];

export default function Leads() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useApiQuery('admin-leads', '/admin/leads', { status, page });
  const update = useApiMutation({ method: 'PATCH', invalidate: ['admin-leads'], success: 'Lead updated' });
  return (
    <>
      <PageHeader title="Leads & demo requests" description="Submissions from the contact and book-a-demo forms." actions={
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>} />
      <Card>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : data.data.length === 0 ? <EmptyState icon={Inbox} title="No leads yet" description="Contact and demo requests from the website appear here." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px]">
            <thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Received', 'Type', 'Contact', 'Company', 'Message', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">
              {data.data.map((l) => (
                <tr key={l._id}>
                  <td className="td whitespace-nowrap text-slate-500">{dateTime(l.createdAt)}</td>
                  <td className="td"><Badge color={l.type === 'demo' ? 'violet' : 'blue'}>{l.type}</Badge></td>
                  <td className="td"><p className="font-medium">{l.name}</p><a href={`mailto:${l.email}`} className="text-xs text-royal-600">{l.email}</a>{l.phone && <p className="text-xs text-slate-500">{l.phone}</p>}</td>
                  <td className="td">{l.company || '—'}{l.employees && <p className="text-xs text-slate-500">{l.employees} people</p>}</td>
                  <td className="td max-w-xs text-sm text-slate-600 dark:text-slate-400">{l.message || '—'}</td>
                  <td className="td"><select className="input py-1.5" value={l.status} onChange={(e) => update.mutate({ path: `/admin/leads/${l._id}`, body: { status: e.target.value } })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
