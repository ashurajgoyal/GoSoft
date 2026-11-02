import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, FileText } from 'lucide-react';
import { Card, PageHeader, Button, Select, Pagination, PageLoader, EmptyState, ErrorState, StatusBadge, Badge, Tabs } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { inr, date, titleCase } from '../../lib/format';
import { downloadFile } from '../../lib/download';

export default function Invoices() {
  const can = useCan();
  const [type, setType] = useState('invoice');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useApiQuery('invoices', '/company/billing/invoices', { type, status, q, page });
  return (
    <>
      <PageHeader title="Invoices & notes" description="GST invoices, proforma invoices, credit notes and debit notes." actions={<>
        {can('billing.invoice.export') && <Button variant="secondary" icon={Download} onClick={() => downloadFile(`/company/billing/invoices/export.csv?type=${type}`, `${type}s.csv`)}>Export</Button>}
        {can('billing.invoice.create') && <Link to={`/app/billing/invoices/new?type=${type}`}><Button icon={Plus}>New {titleCase(type)}</Button></Link>}
      </>} />
      <Tabs value={type} onChange={(v) => { setType(v); setPage(1); }} tabs={[['invoice', 'Tax invoices'], ['proforma', 'Proforma'], ['credit_note', 'Credit notes'], ['debit_note', 'Debit notes']].map(([value, label]) => ({ value, label }))} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-soft-200 p-4 dark:border-white/10 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Invoice number or customer" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-44">{['all', 'draft', 'issued', 'partially_paid', 'paid', 'cancelled'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : titleCase(s)}</option>)}</Select>
        </div>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data.data.length ? (
          <EmptyState icon={FileText} title="Nothing here yet" description="Create your first GST invoice in under a minute." action={can('billing.invoice.create') && <Link to={`/app/billing/invoices/new?type=${type}`}><Button icon={Plus}>Create</Button></Link>} />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px]">
            <thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Number', 'Date', 'Customer', 'Tax', 'Total', 'Balance', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">
              {data.data.map((i) => (
                <tr key={i._id} className="hover:bg-soft-50 dark:hover:bg-white/5">
                  <td className="td"><Link to={`/app/billing/invoices/${i._id}`} className="font-semibold text-royal-600 dark:text-electric-400">{i.number}</Link></td>
                  <td className="td text-slate-500">{date(i.date)}{i.dueDate && i.status !== 'paid' && new Date(i.dueDate) < new Date() && i.type === 'invoice' && <Badge color="red" className="ml-2">Overdue</Badge>}</td>
                  <td className="td">{i.customerSnapshot?.name}<p className="text-xs text-slate-500">{i.customerSnapshot?.gstin}</p></td>
                  <td className="td">{inr(i.totalTax, { maximumFractionDigits: 2 })}<p className="text-xs text-slate-500">{i.interState ? 'IGST' : 'CGST+SGST'}</p></td>
                  <td className="td font-semibold">{inr(i.grandTotal)}</td>
                  <td className="td">{['invoice', 'debit_note'].includes(i.type) ? inr(i.grandTotal - (i.amountPaid || 0)) : '—'}</td>
                  <td className="td"><StatusBadge status={i.status} /></td>
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
