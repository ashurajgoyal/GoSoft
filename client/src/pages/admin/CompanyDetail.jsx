import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, PlayCircle, ShieldOff, CalendarPlus, CreditCard, Gauge } from 'lucide-react';
import { Card, PageLoader, ErrorState, StatusBadge, Badge, Button, Modal, Input, Select, Textarea } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { date, dateTime, limitLabel, titleCase } from '../../lib/format';

const CATEGORIES = ['payment', 'abuse', 'security', 'terms', 'fraud', 'administrative'];

function StatusModal({ action, companyId, onClose }) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('administrative');
  const m = useApiMutation({ method: 'PATCH', path: `/admin/companies/${companyId}/status`, invalidate: ['admin-company', 'admin-companies'], success: 'Company status updated', onSuccess: onClose });
  const needsReason = action === 'suspend' || action === 'block';
  return (
    <Modal open onClose={onClose} title={`${titleCase(action)} company`}
      description={action === 'block' ? 'Blocking signs out every user immediately. Data is preserved.' : needsReason ? 'Users will see the reason and your support contact.' : 'Users regain access immediately.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={needsReason ? 'danger' : 'primary'} loading={m.isPending} onClick={() => m.mutate({ body: { action, reason: reason || undefined, category: needsReason ? category : undefined } })}>Confirm</Button></>}>
      {needsReason ? (
        <div className="space-y-4">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>
          <Textarea label="Reason (shown to the company)" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
      ) : <p className="text-sm text-slate-500">Are you sure?</p>}
    </Modal>
  );
}

function TrialModal({ companyId, onClose }) {
  const [days, setDays] = useState(7);
  const [note, setNote] = useState('');
  const m = useApiMutation({ path: `/admin/companies/${companyId}/trial`, invalidate: ['admin-company'], success: 'Trial extended', onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Extend trial" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ body: { days: Number(days), note: note || undefined } })}>Extend</Button></>}>
      <div className="space-y-4"><Input label="Extra days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} /><Input label="Note (internal)" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Modal>
  );
}

function SubscriptionModal({ companyId, current, onClose }) {
  const { data: plans } = useApiQuery('admin-plans', '/admin/plans');
  const [form, setForm] = useState({ planId: current?.plan?._id || '', status: current?.status || 'active', billingCycle: current?.billingCycle || 'monthly', periodEnd: '', graceDaysOverride: current?.graceDaysOverride ?? '', note: '' });
  const m = useApiMutation({ method: 'PATCH', path: `/admin/companies/${companyId}/subscription`, invalidate: ['admin-company', 'admin-companies'], success: 'Subscription updated', onSuccess: onClose });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = () => m.mutate({ body: {
    planId: form.planId || undefined, status: form.status, billingCycle: form.billingCycle,
    periodEnd: form.periodEnd || undefined, graceDaysOverride: form.graceDaysOverride === '' ? null : Number(form.graceDaysOverride), note: form.note || undefined,
  } });
  return (
    <Modal open onClose={onClose} title="Manage subscription" description="Manual changes — e.g. offline payment or courtesy upgrade. Cashfree automates this in Phase 2."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={submit}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Plan" value={form.planId} onChange={set('planId')}><option value="">Select plan</option>{plans?.data?.filter((p) => !p.isArchived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
        <Select label="Status" value={form.status} onChange={set('status')}>{['trialing', 'active', 'past_due', 'cancelled', 'expired'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
        <Select label="Billing cycle" value={form.billingCycle} onChange={set('billingCycle')}><option value="monthly">Monthly</option><option value="annual">Annual</option></Select>
        <Input label="Period end (optional)" type="date" value={form.periodEnd} onChange={set('periodEnd')} hint="Defaults to 30 / 365 days from today when activating" />
        <Input label="Grace days override" type="number" min={0} max={90} placeholder="Use platform default" value={form.graceDaysOverride} onChange={set('graceDaysOverride')} />
        <Input label="Note" value={form.note} onChange={set('note')} />
      </div>
    </Modal>
  );
}

function LimitsModal({ company, onClose }) {
  const lo = company.limitOverrides || {};
  const [form, setForm] = useState({ users: lo.users ?? '', employees: lo.employees ?? '', invoicesPerMonth: lo.invoicesPerMonth ?? '', storageMB: lo.storageMB ?? '' });
  const m = useApiMutation({ method: 'PATCH', path: `/admin/companies/${company._id}/limits`, invalidate: ['admin-company'], success: 'Limits updated', onSuccess: onClose });
  const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : Number(v)]));
  return (
    <Modal open onClose={onClose} title="Company limit overrides" description="Leave blank to use the plan limit. Use -1 for unlimited."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ body })}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {[['users', 'Users'], ['employees', 'Employees'], ['invoicesPerMonth', 'Invoices / month'], ['storageMB', 'Storage (MB)']].map(([k, l]) => (
          <Input key={k} label={l} type="number" min={-1} placeholder="Plan default" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        ))}
      </div>
    </Modal>
  );
}

export default function CompanyDetail() {
  const { id } = useParams();
  const [modal, setModal] = useState(null);
  const { data, isLoading, error, refetch } = useApiQuery(['admin-company', id], `/admin/companies/${id}`);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { company, subscription, users, activity, rolesCount } = data.data;
  const plan = subscription?.plan;

  return (
    <>
      <Link to="/admin/companies" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />All companies</Link>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">{company.name}</h1><StatusBadge status={company.status} /></div>
          <p className="mt-1 text-sm text-slate-500">{company.email} · {titleCase(company.businessType)} {company.gstin && `· GSTIN ${company.gstin}`} · Registered {date(company.createdAt)}</p>
          {company.suspension?.reason && <p className="mt-2 text-sm text-red-600">{titleCase(company.suspension.category)}: {company.suspension.reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {company.status === 'pending' && <Button icon={PlayCircle} onClick={() => setModal('activate')}>Approve</Button>}
          {['suspended', 'blocked'].includes(company.status) && <Button icon={PlayCircle} onClick={() => setModal('reactivate')}>Reactivate</Button>}
          {['active', 'pending'].includes(company.status) && <Button variant="secondary" icon={ShieldOff} onClick={() => setModal('suspend')}>Suspend</Button>}
          {company.status !== 'blocked' && <Button variant="danger" icon={Ban} onClick={() => setModal('block')}>Block</Button>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-navy-900 dark:text-white">Subscription</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => setModal('trial')} disabled={!subscription}>Extend trial</Button>
              <Button size="sm" icon={CreditCard} onClick={() => setModal('subscription')}>Manage</Button>
            </div>
          </div>
          {subscription ? (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Plan</p><p className="font-semibold">{plan?.name}</p></div>
                <div><p className="text-xs text-slate-500">Effective state</p><StatusBadge status={subscription.effective.state} /></div>
                <div><p className="text-xs text-slate-500">{subscription.status === 'trialing' ? 'Trial ends' : 'Period ends'}</p><p className="font-semibold">{date(subscription.effective.endsAt)}</p></div>
                <div><p className="text-xs text-slate-500">Billing</p><p className="font-semibold capitalize">{subscription.billingCycle}</p></div>
              </div>
              <h3 className="mb-2 mt-6 text-sm font-semibold">History</h3>
              <ul className="space-y-2 text-sm">
                {[...(subscription.history || [])].reverse().slice(0, 8).map((h, i) => (
                  <li key={i} className="flex justify-between gap-3 rounded-lg bg-soft-50 px-3 py-2 dark:bg-white/5"><span><b>{titleCase(h.event)}</b> {h.note && `— ${h.note}`}{h.by?.name && <span className="text-slate-500"> · {h.by.name}</span>}</span><span className="shrink-0 text-slate-500">{dateTime(h.at)}</span></li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-slate-500">No subscription yet.</p>}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-navy-900 dark:text-white">Limits & usage</h2><Button size="sm" variant="ghost" icon={Gauge} onClick={() => setModal('limits')}>Override</Button></div>
          <dl className="space-y-3 text-sm">
            {[['Users', users.length, 'users'], ['Employees', '—', 'employees'], ['Invoices / month', '—', 'invoicesPerMonth'], ['Storage (MB)', company.usage?.storageMB || 0, 'storageMB']].map(([l, used, k]) => {
              const override = company.limitOverrides?.[k];
              const limit = override ?? plan?.limits?.[k];
              return (
                <div key={k} className="flex justify-between"><dt className="text-slate-500">{l}</dt>
                  <dd className="font-medium">{used} / {limitLabel(limit)} {override !== null && override !== undefined && <Badge color="violet" className="ml-1">override</Badge>}</dd></div>
              );
            })}
            <div className="flex justify-between"><dt className="text-slate-500">Roles</dt><dd className="font-medium">{rolesCount}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Last activity</dt><dd className="font-medium">{dateTime(company.lastActivityAt)}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="p-5 pb-3 font-bold text-navy-900 dark:text-white">Users ({users.length})</h2>
          <div className="overflow-x-auto"><table className="w-full">
            <thead className="border-y border-soft-200 dark:border-white/10"><tr>{['Name', 'Role', 'Status', 'Last login'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">
              {users.map((u) => <tr key={u._id}><td className="td"><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td><td className="td">{u.role?.name}</td><td className="td"><StatusBadge status={u.status} /></td><td className="td text-slate-500">{dateTime(u.lastLoginAt)}</td></tr>)}
            </tbody>
          </table></div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-bold text-navy-900 dark:text-white">Recent activity</h2>
          <ul className="space-y-3">
            {activity.length === 0 && <li className="text-sm text-slate-500">No activity yet.</li>}
            {activity.map((a) => (
              <li key={a._id} className="border-l-2 border-royal-600/30 pl-3 text-sm"><p className="font-medium">{a.summary || titleCase(a.action.replace('.', ' '))}</p><p className="text-xs text-slate-500">{a.actorName || 'System'} · {dateTime(a.createdAt)}</p></li>
            ))}
          </ul>
        </Card>
      </div>

      {['activate', 'reactivate', 'suspend', 'block'].includes(modal) && <StatusModal action={modal} companyId={id} onClose={() => setModal(null)} />}
      {modal === 'trial' && <TrialModal companyId={id} onClose={() => setModal(null)} />}
      {modal === 'subscription' && <SubscriptionModal companyId={id} current={subscription} onClose={() => setModal(null)} />}
      {modal === 'limits' && <LimitsModal company={company} onClose={() => setModal(null)} />}
    </>
  );
}
