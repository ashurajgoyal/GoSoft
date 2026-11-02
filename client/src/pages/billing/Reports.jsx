import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { IndianRupee, FileText, AlertCircle, Wallet } from 'lucide-react';
import { Card, PageHeader, Stat, Input, PageLoader, ErrorState, EmptyState } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { inr, date, num } from '../../lib/format';

const Tip = ({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border border-soft-200 bg-white px-3 py-2 text-xs shadow dark:border-white/10 dark:bg-navy-800"><b>{label}</b><p>{inr(payload[0].value)}</p></div> : null;

export default function BillingReports() {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: yearAgo, to: today });
  const { data, isLoading, error, refetch } = useApiQuery('billing-reports', '/company/billing/reports/summary', range);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  const gst = d.gst.reduce((acc, g) => { const k = g.taxRate; acc[k] ||= { taxRate: k, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }; const s = g.creditNote ? -1 : 1; for (const f of ['taxableValue', 'cgst', 'sgst', 'igst']) acc[k][f] += s * g[f]; return acc; }, {});
  return (
    <>
      <PageHeader title="Sales & GST reports" description="Revenue, tax liability, outstanding and expenses."
        actions={<div className="flex gap-2"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={inr(d.totals.revenue)} icon={IndianRupee} hint={`${num(d.totals.invoices)} invoices`} />
        <Stat label="Outstanding" value={inr(d.totals.outstanding)} icon={FileText} tone="amber" />
        <Stat label="Overdue" value={inr(d.totals.overdue)} icon={AlertCircle} tone="red" />
        <Stat label="Expenses" value={inr(d.totals.expenses)} icon={Wallet} tone="violet" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2"><h2 className="mb-1 font-bold">Monthly revenue</h2><p className="mb-4 text-xs text-slate-500">Invoice totals including GST</p>
          {d.monthly.length ? <div className="h-64"><ResponsiveContainer><BarChart data={d.monthly} margin={{ left: 0 }}><CartesianGrid vertical={false} stroke="#e2e8f2" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(30,79,216,.06)' }} /><Bar dataKey="revenue" fill="#1E4FD8" radius={[4, 4, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No invoices in this period" />}
        </Card>
        <Card className="p-5"><h2 className="mb-4 font-bold">Top customers</h2>
          {d.topCustomers.map((c) => <div key={c.name} className="flex justify-between border-b border-soft-200 py-2 text-sm last:border-0 dark:border-white/10"><span>{c.name}</span><b>{inr(c.revenue)}</b></div>)}
          {!d.topCustomers.length && <p className="text-sm text-slate-500">No data</p>}
          <h2 className="mb-3 mt-6 font-bold">Expenses by category</h2>
          {d.expenses.map((e) => <div key={e.category} className="flex justify-between py-1.5 text-sm"><span>{e.category}</span><span>{inr(e.amount)}</span></div>)}
        </Card>
        <Card className="lg:col-span-2"><h2 className="p-5 pb-2 font-bold">GST summary (net of credit notes)</h2>
          <div className="overflow-x-auto"><table className="w-full"><thead className="border-y border-soft-200 dark:border-white/10"><tr>{['Rate', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Total tax'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">{Object.values(gst).map((g) => <tr key={g.taxRate}><td className="td">{g.taxRate}%</td><td className="td">{inr(g.taxableValue, { maximumFractionDigits: 2 })}</td><td className="td">{inr(g.cgst, { maximumFractionDigits: 2 })}</td><td className="td">{inr(g.sgst, { maximumFractionDigits: 2 })}</td><td className="td">{inr(g.igst, { maximumFractionDigits: 2 })}</td><td className="td font-semibold">{inr(g.cgst + g.sgst + g.igst, { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>
        </Card>
        <Card><h2 className="p-5 pb-2 font-bold">Outstanding invoices</h2>
          <div className="max-h-80 overflow-y-auto">{d.outstanding.map((o) => <div key={o._id} className="flex justify-between gap-2 border-t border-soft-200 px-5 py-2.5 text-sm dark:border-white/10"><span><b>{o.number}</b><br /><span className="text-xs text-slate-500">{o.customer} · due {date(o.dueDate)}</span></span><b className={o.dueDate && new Date(o.dueDate) < new Date() ? 'text-red-600' : ''}>{inr(o.due)}</b></div>)}
            {!d.outstanding.length && <p className="px-5 pb-5 text-sm text-slate-500">All invoices are paid 🎉</p>}</div>
        </Card>
      </div>
    </>
  );
}
