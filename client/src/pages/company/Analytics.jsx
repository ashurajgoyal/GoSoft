import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { Card, PageHeader, PageLoader, ErrorState, EmptyState } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { inr, num } from '../../lib/format';

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: '#94a3b8' } };
const Tip = ({ active, payload, label, fmt = num }) => active && payload?.length ? <div className="rounded-lg border border-soft-200 bg-white px-3 py-2 text-xs shadow dark:border-white/10 dark:bg-navy-800"><b>{label}</b>{payload.map((p) => <p key={p.dataKey}>{p.name}: {fmt(p.value)}</p>)}</div> : null;
const STATUS = [['todo', 'To do'], ['in_progress', 'In progress'], ['review', 'Review'], ['completed', 'Completed'], ['on_hold', 'On hold']];

export default function Analytics() {
  const { data, isLoading, error, refetch } = useApiQuery('analytics', '/company/analytics');
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  const total = Object.values(d.tasks).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Business analytics" description="Revenue, people, attendance and delivery at a glance." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><h2 className="mb-1 font-bold">Revenue (last 6 months)</h2><p className="mb-4 text-xs text-slate-500">Invoice totals incl. GST</p>
          {d.revenue.length ? <div className="h-60"><ResponsiveContainer><BarChart data={d.revenue}><CartesianGrid vertical={false} stroke="#e2e8f2" /><XAxis dataKey="month" {...axis} /><YAxis {...axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip content={<Tip fmt={inr} />} cursor={{ fill: 'rgba(30,79,216,.06)' }} /><Bar dataKey="value" name="Revenue" fill="#1E4FD8" radius={[4, 4, 0, 0]} maxBarSize={32} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No revenue data" />}</Card>
        <Card className="p-5"><h2 className="mb-1 font-bold">Daily attendance (30 days)</h2><p className="mb-4 text-xs text-slate-500">Present vs late check-ins</p>
          {d.attendance.length ? <div className="h-60"><ResponsiveContainer><LineChart data={d.attendance}><CartesianGrid vertical={false} stroke="#e2e8f2" /><XAxis dataKey="date" {...axis} /><YAxis {...axis} allowDecimals={false} />
            <Tooltip content={<Tip />} /><Line dataKey="present" name="Present" stroke="#1E4FD8" strokeWidth={2} dot={false} /><Line dataKey="late" name="Late" stroke="#D97706" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <EmptyState title="No attendance data" />}
          {d.attendance.length > 0 && <div className="mt-2 flex gap-4 text-xs"><span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-royal-600" />Present</span><span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-600" />Late</span></div>}</Card>
        <Card className="p-5"><h2 className="mb-4 font-bold">Headcount by department</h2>
          {d.headcount.length ? d.headcount.map((h) => { const max = Math.max(...d.headcount.map((x) => x.value)); return <div key={h.name} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{h.name}</span><b>{h.value}</b></div><div className="h-2 rounded-full bg-soft-100 dark:bg-white/10"><div className="h-full rounded-full bg-royal-600" style={{ width: `${(h.value / max) * 100}%` }} /></div></div>; }) : <EmptyState title="No employees" />}</Card>
        <Card className="p-5"><h2 className="mb-4 font-bold">Task pipeline</h2>
          {total ? STATUS.map(([k, l]) => <div key={k} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span>{l}</span><b>{d.tasks[k] || 0}</b></div><div className="h-2 rounded-full bg-soft-100 dark:bg-white/10"><div className="h-full rounded-full bg-royal-600" style={{ width: `${((d.tasks[k] || 0) / total) * 100}%` }} /></div></div>) : <EmptyState title="No tasks" />}</Card>
      </div>
    </>
  );
}
