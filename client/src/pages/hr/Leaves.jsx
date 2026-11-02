import { useState } from 'react';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, PageHeader, Button, Input, Select, Textarea, Toggle, Modal, Badge, Tabs, PageLoader, EmptyState, StatusBadge } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { api } from '../../lib/api';
import { date } from '../../lib/format';

export function LeaveBalances() {
  const { data, isLoading, error } = useApiQuery('leave-balance', '/company/hr/leaves/me/balance');
  if (isLoading) return <PageLoader />;
  if (error) return <p className="text-sm text-slate-500">{error.message}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {data.data.filter((b) => b.leaveType.paid).map((b) => (
        <Card key={b.leaveType._id} className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: b.leaveType.color }} />{b.leaveType.name}</div>
          <p className="mt-2 font-display text-2xl font-extrabold">{b.available}<span className="text-sm font-medium text-slate-500"> / {b.quota} left</span></p>
          <p className="text-xs text-slate-500">{b.used} used{b.pending ? ` · ${b.pending} pending` : ''}</p></Card>
      ))}
    </div>
  );
}

export function ApplyLeave({ onClose }) {
  const { data: types } = useQuery({ queryKey: ['leave-types-active'], queryFn: () => api('/company/hr/leaves/me/balance') });
  const [f, setF] = useState({ leaveType: '', from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), halfDay: false, reason: '' });
  const m = useApiMutation({ path: '/company/hr/leaves', invalidate: ['leaves', 'leave-balance'], success: 'Leave request submitted', onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Apply for leave" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ body: { ...f, to: f.halfDay ? f.from : f.to } })}>Submit</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select className="sm:col-span-2" label="Leave type" value={f.leaveType} onChange={(e) => setF({ ...f, leaveType: e.target.value })}><option value="">Select</option>
          {types?.data?.map((b) => <option key={b.leaveType._id} value={b.leaveType._id}>{b.leaveType.name}{b.leaveType.paid ? ` (${b.available} left)` : ''}</option>)}</Select>
        <Input label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        {!f.halfDay && <Input label="To" type="date" value={f.to} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value })} />}
        <div className="sm:col-span-2"><Toggle label="Half day" checked={f.halfDay} onChange={(v) => setF({ ...f, halfDay: v })} /></div>
        <Textarea className="sm:col-span-2" label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </div>
    </Modal>
  );
}

export default function Leaves() {
  const can = useCan();
  const approver = can('hrms.leave.approve');
  const [tab, setTab] = useState(approver ? 'pending' : 'mine');
  const [apply, setApply] = useState(false);
  const { data, isLoading } = useApiQuery('leaves', '/company/hr/leaves', tab === 'mine' ? { mine: '1' } : { status: tab === 'pending' ? 'pending' : 'all' });
  const review = useApiMutation({ invalidate: ['leaves'], success: 'Leave request updated' });
  const cancel = useApiMutation({ invalidate: ['leaves', 'leave-balance'], success: 'Leave cancelled' });
  return (
    <>
      <PageHeader title="Leave" description="Balances, requests and approvals." actions={can('hrms.leave.create') && <Button icon={Plus} onClick={() => setApply(true)}>Apply leave</Button>} />
      {can('hrms.leave.create') && <div className="mb-6"><LeaveBalances /></div>}
      <Tabs value={tab} onChange={setTab} tabs={[...(approver ? [{ value: 'pending', label: 'Awaiting approval' }, { value: 'all', label: 'All requests' }] : []), { value: 'mine', label: 'My requests' }]} />
      <Card>
        {isLoading ? <PageLoader /> : !data?.data?.length ? <EmptyState title="No leave requests" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Employee', 'Type', 'Dates', 'Days', 'Reason', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((l) => (
              <tr key={l._id}><td className="td">{l.employee ? `${l.employee.firstName} ${l.employee.lastName || ''}` : '—'}</td>
                <td className="td"><Badge className="text-white" color="gray"><span className="h-2 w-2 rounded-full" style={{ background: l.leaveType?.color }} />{l.leaveType?.name}</Badge></td>
                <td className="td">{date(l.from)}{String(l.from) !== String(l.to) && ` → ${date(l.to)}`}</td><td className="td">{l.days}</td>
                <td className="td max-w-xs truncate text-slate-500" title={l.reason}>{l.reason || '—'}{l.reviewNote && <p className="text-xs">Note: {l.reviewNote}</p>}</td><td className="td"><StatusBadge status={l.status} /></td>
                <td className="td"><div className="flex gap-1">
                  {tab !== 'mine' && l.status === 'pending' && approver && <>
                    <button onClick={() => review.mutate({ path: `/company/hr/leaves/${l._id}/review`, body: { approve: true } })} className="text-emerald-600" aria-label="Approve"><CheckCircle2 className="h-5 w-5" /></button>
                    <button onClick={() => { const note = window.prompt('Reason for rejection (optional)') ?? undefined; review.mutate({ path: `/company/hr/leaves/${l._id}/review`, body: { approve: false, note: note || undefined } }); }} className="text-red-500" aria-label="Reject"><XCircle className="h-5 w-5" /></button></>}
                  {tab === 'mine' && l.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => cancel.mutate({ path: `/company/hr/leaves/${l._id}/cancel` })}>Withdraw</Button>}
                </div></td></tr>))}</tbody></table></div>
        )}
      </Card>
      {apply && <ApplyLeave onClose={() => setApply(false)} />}
    </>
  );
}
