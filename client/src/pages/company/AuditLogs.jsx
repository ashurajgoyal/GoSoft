import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Card, PageHeader, Input, Pagination, PageLoader, EmptyState, ErrorState } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { AuditTable } from '../admin/AuditLogs';

export default function CompanyAuditLogs() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useApiQuery('company-audit', '/company/audit-logs', { action, page });
  return (
    <>
      <PageHeader title="Audit logs" description="Every sensitive change in your workspace — who did what, and when." />
      <Card>
        <div className="border-b border-soft-200 p-4 dark:border-white/10"><Input placeholder="Filter by action, e.g. user. or role." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="max-w-sm" /></div>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : data.data.length === 0 ? <EmptyState icon={ScrollText} title="No activity yet" /> : <AuditTable items={data.data} />}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
