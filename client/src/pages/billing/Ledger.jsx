import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Card, PageHeader, Button, PageLoader, ErrorState } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { inr, date, titleCase } from '../../lib/format';

export default function Ledger() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useApiQuery(['ledger', id], `/company/billing/customers/${id}/ledger`);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  return (
    <>
      <Link to="/app/billing/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 print:hidden"><ArrowLeft className="h-4 w-4" />Customers</Link>
      <PageHeader title={`Ledger — ${d.customer.name}`} description={d.customer.gstin} actions={<Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>} />
      <Card><div className="overflow-x-auto"><table className="w-full">
        <thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Date', 'Reference', 'Type', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-soft-200 dark:divide-white/10">
          <tr><td className="td" colSpan={5}><b>Opening balance</b></td><td className="td font-semibold">{inr(d.openingBalance)}</td></tr>
          {d.entries.map((e, i) => <tr key={i}><td className="td">{date(e.date)}</td><td className="td">{e.ref}</td><td className="td">{titleCase(e.type)}</td><td className="td">{e.debit ? inr(e.debit, { maximumFractionDigits: 2 }) : ''}</td><td className="td">{e.credit ? inr(e.credit, { maximumFractionDigits: 2 }) : ''}</td><td className="td font-medium">{inr(e.balance, { maximumFractionDigits: 2 })}</td></tr>)}
          <tr className="bg-soft-50 dark:bg-white/5"><td className="td" colSpan={5}><b>Closing balance (receivable)</b></td><td className="td text-base font-extrabold">{inr(d.closingBalance, { maximumFractionDigits: 2 })}</td></tr>
        </tbody></table></div></Card>
    </>
  );
}
