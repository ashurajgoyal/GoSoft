import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, CalendarDays, FileText, ListTodo, Plus, UserCircle2 } from 'lucide-react';
import { Card, PageHeader, Button, Badge, PageLoader, ErrorState, StatusBadge } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { useCan, hasModule } from '../../lib/permissions';
import { useAuth } from '../../store/auth';
import { date, inr } from '../../lib/format';
import { PunchCard } from '../hr/Attendance';
import { LeaveBalances, ApplyLeave } from '../hr/Leaves';
import { NewRequest } from '../hr/Requests';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Employee self-service portal. */
export default function MyHome() {
  const can = useCan();
  const session = useAuth((s) => s.session);
  const hrms = hasModule(session, 'hrms');
  const [leave, setLeave] = useState(false);
  const [req, setReq] = useState(false);
  const { data, isLoading, error, refetch } = useApiQuery('me-home', '/company/me/home');
  const { data: slips } = useApiQuery('my-payslips', '/company/payroll/payslips/me', undefined, { enabled: hasModule(session, 'payroll') && can('payroll.payslip.view') });
  const { data: holidays } = useApiQuery('holiday-cal', '/company/hr/holidays/calendar', undefined, { enabled: hrms });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { employee: e, announcements, myTasks, leaves } = data.data;
  const upcoming = (holidays?.data || []).filter((h) => new Date(h.date) >= new Date(new Date().toDateString())).slice(0, 5);

  return (
    <>
      <PageHeader title="My workspace" description="Your attendance, leave, payslips, tasks and company updates."
        actions={<>{hrms && can('hrms.leave.create') && e && <Button icon={Plus} onClick={() => setLeave(true)}>Apply leave</Button>}{hrms && e && can('hrms.document.create') && <Button variant="secondary" onClick={() => setReq(true)}>New request</Button>}</>} />
      {!e && hrms && <Card className="mb-6 p-4 text-sm text-amber-700">Your login isn’t linked to an employee profile yet. Ask HR to link it to see attendance, leave and payslips.</Card>}
      <div className="grid gap-6 lg:grid-cols-3">
        {hrms && e && <PunchCard />}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start gap-4"><UserCircle2 className="h-12 w-12 text-royal-600" />
            <div className="flex-1"><h2 className="text-lg font-bold">{session.user.name}</h2><p className="text-sm text-slate-500">{e ? `${e.designation || ''} · ${e.department?.name || ''} · ${e.employeeId}` : session.role?.name}</p>
              {e && <p className="mt-1 text-xs text-slate-500">Joined {date(e.joiningDate)}{e.reportingManager && ` · Reports to ${e.reportingManager.firstName} ${e.reportingManager.lastName || ''}`}</p>}</div>
            <Link to="/app/profile"><Button size="sm" variant="secondary">Profile</Button></Link></div>
          {hrms && e && <div className="mt-5"><LeaveBalances /></div>}
        </Card>

        <Card className="p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4 text-royal-600" />Announcements</h2>
          {announcements.length ? announcements.map((a) => <div key={a._id} className="mb-3 rounded-xl bg-soft-50 p-3 dark:bg-white/5"><p className="font-semibold">{a.pinned && '📌 '}{a.title}</p><p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-400">{a.body}</p><p className="mt-1 text-xs text-slate-400">{date(a.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No announcements.</p>}</Card>

        {myTasks.length > 0 && <Card className="p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><ListTodo className="h-4 w-4 text-royal-600" />My tasks</h2>
          {myTasks.map((t) => <Link key={t._id} to="/app/tasks" className="flex items-center justify-between border-b border-soft-200 py-2 text-sm last:border-0 dark:border-white/10"><span>{t.title}</span><span className="text-xs text-slate-500">{date(t.dueDate)}</span></Link>)}</Card>}

        {slips?.data?.length > 0 && <Card className="p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><FileText className="h-4 w-4 text-royal-600" />Payslips & salary history</h2>
          {slips.data.slice(0, 6).map((p) => <Link key={p._id} to={`/app/payroll/payslips/${p._id}`} className="flex justify-between border-b border-soft-200 py-2 text-sm last:border-0 hover:text-royal-600 dark:border-white/10"><span>{MONTHS[p.month - 1]} {p.year}</span><b>{inr(p.netPay)}</b></Link>)}</Card>}

        {leaves.length > 0 && <Card className="p-5"><h2 className="mb-3 font-bold">Recent leave requests</h2>
          {leaves.map((l) => <div key={l._id} className="flex items-center justify-between py-1.5 text-sm"><span>{l.leaveType?.name} · {date(l.from)}</span><StatusBadge status={l.status} /></div>)}</Card>}

        {upcoming.length > 0 && <Card className="p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-royal-600" />Upcoming holidays</h2>
          {upcoming.map((h) => <div key={h._id} className="flex justify-between py-1.5 text-sm"><span>{h.name} {h.optional && <Badge color="amber">Optional</Badge>}</span><span className="text-slate-500">{date(h.date)}</span></div>)}</Card>}
      </div>
      {leave && <ApplyLeave onClose={() => setLeave(false)} />}
      {req && <NewRequest onClose={() => setReq(false)} />}
    </>
  );
}
