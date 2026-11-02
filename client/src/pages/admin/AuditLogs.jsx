import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card, PageHeader, Input, Pagination, PageLoader, EmptyState, ErrorState, Badge } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { dateTime } from '../../lib/format';

export function AuditTable({ items, showCompany }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[720px]">
      <thead className="border-b border-soft-200 dark:border-white/10"><tr>{['When', 'Action', ...(showCompany ? ['Company'] : []), 'Actor', 'Details', 'IP'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-soft-200 dark:divide-white/10">
        {items.map((a) => (
          <tr key={a._id}>
            <td className="td whitespace-nowrap text-slate-500">{dateTime(a.createdAt)}</td>
            <td className="td"><Badge color={a.action.includes('suspend') || a.action.includes('block') || a.action.includes('delete') || a.action.includes('locked') ? 'red' : 'blue'}>{a.action}</Badge></td>
            {showCompany && <td className="td">{a.company?.name || '—'}</td>}
            <td className="td">{a.actorName || 'System'}<p className="text-xs text-slate-500">{a.actorType?.replace('_', ' ')}</p></td>
            <td className="td max-w-xs truncate">{a.summary || '—'}</td>
            <td className="td text-xs text-slate-500">{a.ip}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

export default function AuditLogs() {
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useApiQuery('admin-audit', '/admin/audit-logs', { q, action, page });
  return (
    <>
      <PageHeader title="Audit logs" description="Append-only record of every sensitive action on the platform." />
      <Card>
        <div className="grid gap-3 border-b border-soft-200 p-4 dark:border-white/10 sm:grid-cols-2">
          <Input placeholder="Search summary or actor" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Input placeholder="Action prefix, e.g. company. or auth.login" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        </div>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : data.data.length === 0 ? <EmptyState icon={ScrollText} title="No audit entries" /> : <AuditTable items={data.data} showCompany />}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
