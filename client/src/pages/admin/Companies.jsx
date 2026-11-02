import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import { Card, PageHeader, Input, Select, StatusBadge, Pagination, PageLoader, EmptyState, ErrorState, Badge } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { date } from '../../lib/format';

export default function Companies() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useApiQuery('admin-companies', '/admin/companies', { q, status, plan, page });
  const { data: plans } = useApiQuery('admin-plans', '/admin/plans');

  return (
    <>
      <PageHeader title="Companies" description="Every workspace registered on GO SOFT." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-soft-200 p-4 dark:border-white/10 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search name, email, slug or GSTIN" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="md:w-44">
            {['all', 'active', 'pending', 'suspended', 'blocked'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
          </Select>
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="md:w-44">
            <option value="">All plans</option>
            {plans?.data?.map((p) => <option key={p._id} value={p.slug}>{p.name}</option>)}
          </Select>
        </div>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : data.data.length === 0 ? (
          <EmptyState icon={Building2} title="No companies found" description="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-soft-200 dark:border-white/10"><tr>
                {['Company', 'Owner', 'Plan', 'Subscription', 'Users', 'Status', 'Registered'].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-soft-200 dark:divide-white/10">
                {data.data.map((c) => (
                  <tr key={c._id} className="transition hover:bg-soft-50 dark:hover:bg-white/5">
                    <td className="td"><Link to={`/admin/companies/${c._id}`} className="font-semibold text-navy-900 hover:text-royal-600 dark:text-white">{c.name}</Link><p className="text-xs text-slate-500">{c.gstin || c.email}</p></td>
                    <td className="td">{c.owner?.name}<p className="text-xs text-slate-500">{c.owner?.email}</p></td>
                    <td className="td">{c.plan ? <Badge color="blue">{c.plan.name}</Badge> : '—'}</td>
                    <td className="td"><StatusBadge status={c.subscription?.state} />{c.subscription?.endsAt && <p className="mt-0.5 text-xs text-slate-500">ends {date(c.subscription.endsAt)}</p>}</td>
                    <td className="td">{c.users}</td>
                    <td className="td"><StatusBadge status={c.status} /></td>
                    <td className="td text-slate-500">{date(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
