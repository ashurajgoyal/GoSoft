import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, PageLoader, EmptyState, StatusBadge } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { date, titleCase, inr } from '../../lib/format';

export function NewRequest({ onClose }) {
  const [f, setF] = useState({ type: 'document', subject: '', details: '', amount: '' });
  const m = useApiMutation({ path: '/company/hr/requests', invalidate: ['hr-requests'], success: 'Request submitted', onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="New request" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ body: { ...f, amount: f.amount === '' ? undefined : Number(f.amount) } })}>Submit</Button></>}>
      <div className="grid gap-4"><Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['document', 'salary_advance', 'reimbursement', 'asset', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
        <Input label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        {['salary_advance', 'reimbursement'].includes(f.type) && <Input label="Amount (₹)" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}
        <Textarea label="Details" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></div>
    </Modal>
  );
}

export default function Requests() {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useApiQuery('hr-requests', '/company/hr/requests');
  const respond = useApiMutation({ invalidate: ['hr-requests'], success: 'Response saved' });
  return (
    <>
      <PageHeader title="Employee requests" description="Letters, salary advances, reimbursements and other requests." actions={can('hrms.document.create') && <Button icon={Plus} onClick={() => setOpen(true)}>New request</Button>} />
      <Card>{isLoading ? <PageLoader /> : !data?.data?.length ? <EmptyState title="No requests" /> : (
        <div className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((r) => (
          <div key={r._id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div><p className="font-semibold">{r.subject} <StatusBadge status={r.status} /></p><p className="text-xs text-slate-500">{titleCase(r.type)} · {r.employee ? `${r.employee.firstName} ${r.employee.lastName || ''}` : ''} · {date(r.createdAt)}{r.amount ? ` · ${inr(r.amount)}` : ''}</p>
              {r.details && <p className="mt-1 text-sm">{r.details}</p>}{r.response && <p className="mt-1 text-sm text-royal-700 dark:text-electric-300">Response: {r.response}</p>}</div>
            {r.status === 'open' && can('hrms.employee.edit') && <div className="flex gap-2">
              <Button size="sm" onClick={() => respond.mutate({ path: `/company/hr/requests/${r._id}/respond`, body: { status: 'approved', response: window.prompt('Response (optional)') || undefined } })}>Approve</Button>
              <Button size="sm" variant="secondary" onClick={() => respond.mutate({ path: `/company/hr/requests/${r._id}/respond`, body: { status: 'rejected', response: window.prompt('Reason (optional)') || undefined } })}>Reject</Button></div>}
          </div>))}</div>)}</Card>
      {open && <NewRequest onClose={() => setOpen(false)} />}
    </>
  );
}
