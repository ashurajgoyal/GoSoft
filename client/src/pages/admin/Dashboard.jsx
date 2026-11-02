import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Clock, Ban, Users, IndianRupee, TrendingUp, TrendingDown, UserPlus, CreditCard, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, PageHeader, Stat, PageLoader, ErrorState, Button } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { inr, num } from '../../lib/format';

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-soft-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-navy-800">
      <p className="font-semibold text-navy-900 dark:text-white">{label}</p>
      <p className="text-slate-500">{num(payload[0].value)} {unit}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useApiQuery('admin-dashboard', '/admin/dashboard');
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;

  return (
    <>
      <PageHeader title="Platform overview" description="Live health of every GO SOFT workspace." actions={<Link to="/admin/companies"><Button variant="secondary">View companies <ArrowRight className="h-4 w-4" /></Button></Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered companies" value={num(d.companies.total)} icon={Building2} hint={`${num(d.newRegistrations)} new in last 30 days`} />
        <Stat label="Active companies" value={num(d.companies.active)} icon={CheckCircle2} tone="green" hint={`${num(d.companies.pending)} awaiting approval`} />
        <Stat label="On free trial" value={num(d.companies.trial)} icon={Clock} tone="amber" />
        <Stat label="Suspended / blocked" value={num(d.companies.suspended + d.companies.blocked)} icon={Ban} tone="red" />
        <Stat label="Monthly recurring revenue" value={inr(d.revenue.mrr)} icon={IndianRupee} tone="violet" hint="From active paid subscriptions" />
        <Stat label="Annual recurring revenue" value={inr(d.revenue.arr)} icon={TrendingUp} tone="navy" />
        <Stat label="Active subscriptions" value={num(d.subscriptions.active)} icon={CreditCard} hint={`${num(d.subscriptions.expired)} expired / in grace`} />
        <Stat label="Total users" value={num(d.users.total)} icon={Users} tone="green" hint={`Churn (30d): ${d.churnRate}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="font-bold text-navy-900 dark:text-white">New registrations</h2><p className="text-xs text-slate-500">Companies registered per month, last 12 months</p></div>
            <UserPlus className="h-5 w-5 text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.growth} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="currentColor" className="text-soft-200 dark:text-white/10" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: 'rgba(30,79,216,.06)' }} content={<ChartTip unit="companies" />} />
                <Bar dataKey="registrations" fill="#1E4FD8" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-navy-900 dark:text-white">Companies by plan</h2>
          <p className="mb-5 text-xs text-slate-500">Active and trialing subscriptions</p>
          {d.planDistribution.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No subscriptions yet</p> : (
            <div className="space-y-4">
              {d.planDistribution.map((p) => {
                const max = Math.max(...d.planDistribution.map((x) => x.value));
                return (
                  <div key={p.name} title={`${p.name}: ${p.value}`}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{p.name}</span><span className="text-slate-500">{num(p.value)}</span></div>
                    <div className="h-2 rounded-full bg-soft-100 dark:bg-white/10"><div className="h-full rounded-full bg-royal-600" style={{ width: `${(p.value / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6 flex items-start gap-4 p-5">
        <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div className="text-sm">
          <p className="font-semibold text-navy-900 dark:text-white">Payment metrics</p>
          <p className="text-slate-500">{d.revenue.note} Total revenue, failed payments, refunds and payment success rate will appear here.</p>
        </div>
      </Card>
    </>
  );
}
