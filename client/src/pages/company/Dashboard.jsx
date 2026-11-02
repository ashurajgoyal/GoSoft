import { Link } from 'react-router-dom';
import { Users, KeyRound, UserPlus, Settings, CheckCircle2, Lock, CreditCard, ArrowRight } from 'lucide-react';
import { Card, PageHeader, Stat, Progress, PageLoader, ErrorState, Button, Badge } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { can } from '../../lib/permissions';
import { limitLabel, num, dateTime, date } from '../../lib/format';

export default function CompanyDashboard() {
  const session = useAuth((s) => s.session);
  const { data, isLoading, error, refetch } = useApiQuery('company-dashboard', '/company/dashboard');
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const d = data.data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader title={`${greet}, ${session.user.name.split(' ')[0]} 👋`} description={`Here is what's happening at ${session.company.name}.`}
        actions={can(session, 'core.user.create') && <Link to="/app/users?invite=1"><Button icon={UserPlus}>Invite user</Button></Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active users" value={num(d.users.active)} icon={Users} hint={`${d.users.invited} pending invitation(s)`} />
        <Stat label="Roles" value={num(d.roles)} icon={KeyRound} tone="violet" />
        <Stat label="Plan" value={session.subscription?.plan?.name || '—'} icon={CreditCard} tone="green" hint={d.subscription?.endsAt && `${d.subscription.state === 'trialing' ? 'Trial ends' : 'Renews'} ${date(d.subscription.endsAt)}`} />
        <Stat label="Modules enabled" value={`${d.modules.filter((m) => m.enabled).length}/${d.modules.length}`} icon={CheckCircle2} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-5 font-bold text-navy-900 dark:text-white">Plan usage</h2>
          <div className="space-y-5">
            {[['Users', d.usage.users], ['Employees', d.usage.employees], ['Invoices this month', d.usage.invoicesPerMonth], ['Storage (MB)', d.usage.storageMB]].map(([l, u]) => (
              <div key={l}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{l}</span><span className="text-slate-500">{num(u.used)} / {limitLabel(u.limit)}</span></div>
                <Progress value={u.used} max={u.limit} />
              </div>
            ))}
          </div>
          {can(session, 'core.subscription.view') && <Link to="/app/subscription" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-royal-600 dark:text-electric-400">Manage plan <ArrowRight className="h-4 w-4" /></Link>}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-bold text-navy-900 dark:text-white">Your modules</h2>
          <ul className="space-y-2">
            {d.modules.filter((m) => m.key !== 'core').map((m) => (
              <li key={m.key} className="flex items-center justify-between rounded-xl bg-soft-50 px-3 py-2.5 text-sm dark:bg-white/5">
                {m.label}
                {m.enabled ? <Badge color="green">Included</Badge> : <span className="flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3 w-3" />Upgrade</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-bold text-navy-900 dark:text-white">Get started</h2>
          <ol className="space-y-3 text-sm">
            {[['Complete your company profile', '/app/settings', 'core.company.edit', !!session.company.gstin],
              ['Invite your team', '/app/users', 'core.user.create', d.users.active + d.users.invited > 1],
              ['Review roles & permissions', '/app/roles', 'core.role.view', false]].filter(([, , p]) => can(session, p)).map(([t, to, , done]) => (
              <li key={t}><Link to={to} className="flex items-center gap-3 rounded-xl border border-soft-200 p-3 transition hover:border-royal-500/40 dark:border-white/10">
                <CheckCircle2 className={`h-5 w-5 ${done ? 'text-emerald-500' : 'text-slate-300'}`} /><span className={done ? 'text-slate-400 line-through' : 'font-medium'}>{t}</span>
              </Link></li>
            ))}
          </ol>
          {d.recentActivity.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">Recent activity</h3>
              <ul className="space-y-2">{d.recentActivity.slice(0, 5).map((a) => <li key={a._id} className="text-xs"><span className="font-medium">{a.summary || a.action}</span><span className="text-slate-500"> · {a.actorName} · {dateTime(a.createdAt)}</span></li>)}</ul>
            </>
          )}
        </Card>
      </div>
      {can(session, 'core.company.edit') && !session.company.gstin && (
        <Card className="mt-6 flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3"><Settings className="h-5 w-5 text-royal-600" /><p className="text-sm">Add your GSTIN and address so they appear on invoices when billing goes live.</p></div>
          <Link to="/app/settings"><Button size="sm" variant="secondary">Update profile</Button></Link>
        </Card>
      )}
    </>
  );
}
