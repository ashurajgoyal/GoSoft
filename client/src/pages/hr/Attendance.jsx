import { useState } from 'react';
import { LogIn, LogOut, Coffee, Play, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, PageHeader, Button, Input, Modal, Textarea, Badge, Tabs, PageLoader, EmptyState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { useAuth } from '../../store/auth';
import { titleCase } from '../../lib/format';

const t = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
const hrs = (m) => `${Math.floor((m || 0) / 60)}h ${(m || 0) % 60}m`;
const COLORS = { present: 'green', half_day: 'amber', absent: 'red', on_leave: 'violet', holiday: 'blue' };

export function PunchCard() {
  const { data, isLoading, error } = useApiQuery('attendance-today', '/company/hr/attendance/me/today');
  const act = useApiMutation({ invalidate: ['attendance-today', 'attendance'], success: (_, v) => ({ 'check-in': 'Checked in. Have a great day!', 'check-out': 'Checked out. See you tomorrow!', 'break-start': 'Break started', 'break-end': 'Welcome back' }[v.path.split('/').pop()]) });
  if (isLoading) return <Card className="p-6"><PageLoader /></Card>;
  if (error) return <Card className="p-6 text-sm text-slate-500">{error.message}</Card>;
  const a = data.data;
  const onBreak = a?.breaks?.some((b) => !b.end);
  const go = (x) => act.mutate({ path: `/company/hr/attendance/me/${x}` });
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-navy-900 to-royal-600 p-6 text-white">
        <p className="text-sm text-white/70">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p className="mt-1 font-display text-3xl font-extrabold">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><p className="text-white/60">In</p><b>{t(a?.checkIn)}</b></div><div><p className="text-white/60">Out</p><b>{t(a?.checkOut)}</b></div><div><p className="text-white/60">Worked</p><b>{hrs(a?.workMinutes)}</b></div></div>
      </div>
      <div className="flex flex-wrap gap-2 p-5">
        {!a?.checkIn && <Button icon={LogIn} loading={act.isPending} onClick={() => go('check-in')} className="flex-1">Check in</Button>}
        {a?.checkIn && !a.checkOut && <>
          {onBreak ? <Button variant="secondary" icon={Play} onClick={() => go('break-end')}>End break</Button> : <Button variant="secondary" icon={Coffee} onClick={() => go('break-start')}>Start break</Button>}
          <Button icon={LogOut} loading={act.isPending} onClick={() => go('check-out')} className="flex-1">Check out</Button>
        </>}
        {a?.checkOut && <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Day complete · <Badge color={COLORS[a.status]}>{titleCase(a.status)}</Badge>{a.lateMinutes > 0 && <Badge color="amber">Late {a.lateMinutes}m</Badge>}</p>}
      </div>
    </Card>
  );
}

function CorrectionModal({ onClose }) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), in: '09:30', out: '18:30', reason: '' });
  const m = useApiMutation({ path: '/company/hr/attendance/me/correction', invalidate: ['attendance'], success: 'Correction request sent to your manager', onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Request attendance correction" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ body: { date: f.date, checkIn: new Date(`${f.date}T${f.in}:00`), checkOut: new Date(`${f.date}T${f.out}:00`), reason: f.reason } })}>Submit</Button></>}>
      <div className="grid gap-4 sm:grid-cols-3"><Input label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /><Input label="Check in" type="time" value={f.in} onChange={(e) => setF({ ...f, in: e.target.value })} /><Input label="Check out" type="time" value={f.out} onChange={(e) => setF({ ...f, out: e.target.value })} />
        <Textarea className="sm:col-span-3" label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
    </Modal>
  );
}

export default function Attendance() {
  const can = useCan();
  const session = useAuth((s) => s.session);
  const team = session.permissions?.some((p) => p.key === 'hrms.attendance.view' && p.scope !== 'own');
  const [tab, setTab] = useState(team ? 'team' : 'mine');
  const [range, setRange] = useState({ from: new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const [corr, setCorr] = useState(false);
  const { data, isLoading } = useApiQuery('attendance', '/company/hr/attendance', { ...range, correction: tab === 'corrections' ? 'pending' : undefined, mine: tab === 'mine' ? '1' : undefined });
  const review = useApiMutation({ invalidate: ['attendance'], success: 'Correction reviewed' });
  const rows = data?.data || [];
  return (
    <>
      <PageHeader title="Attendance" description="Check-in/out, working hours, late marks and overtime." actions={<Button variant="secondary" icon={Clock} onClick={() => setCorr(true)}>Request correction</Button>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <PunchCard />
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Tabs value={tab} onChange={setTab} tabs={[...(team ? [{ value: 'team', label: 'Team' }] : []), { value: 'mine', label: 'My records' }, ...(can('hrms.attendance.approve') ? [{ value: 'corrections', label: 'Pending corrections' }] : [])]} />
            <div className="flex gap-2"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
          </div>
          {isLoading ? <PageLoader /> : !rows.length ? <EmptyState title="No attendance records" /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead className="border-y border-soft-200 dark:border-white/10"><tr>{['Date', 'Employee', 'In', 'Out', 'Worked', 'Late', 'OT', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-soft-200 dark:divide-white/10">
                {rows.map((r) => (
                  <tr key={r._id}><td className="td">{r.date}</td><td className="td">{r.employee ? `${r.employee.firstName} ${r.employee.lastName || ''}` : '—'}</td><td className="td">{t(r.checkIn)}</td><td className="td">{t(r.checkOut)}</td>
                    <td className="td">{hrs(r.workMinutes)}</td><td className="td">{r.lateMinutes ? <Badge color="amber">{r.lateMinutes}m</Badge> : '—'}</td><td className="td">{r.overtimeMinutes ? hrs(r.overtimeMinutes) : '—'}</td>
                    <td className="td"><Badge color={COLORS[r.status]}>{titleCase(r.status)}</Badge>{r.correction?.status === 'pending' && <Badge color="violet" className="ml-1">Correction</Badge>}</td>
                    <td className="td">{tab === 'corrections' && r.correction?.status === 'pending' && <div className="flex gap-1" title={r.correction.reason}>
                      <button onClick={() => review.mutate({ path: `/company/hr/attendance/${r._id}/correction`, body: { approve: true } })} className="text-emerald-600" aria-label="Approve"><CheckCircle2 className="h-5 w-5" /></button>
                      <button onClick={() => review.mutate({ path: `/company/hr/attendance/${r._id}/correction`, body: { approve: false } })} className="text-red-500" aria-label="Reject"><XCircle className="h-5 w-5" /></button></div>}</td></tr>
                ))}
              </tbody></table></div>
          )}
        </Card>
      </div>
      {corr && <CorrectionModal onClose={() => setCorr(false)} />}
    </>
  );
}
