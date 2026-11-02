import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, CheckCircle2, Banknote, Download, Trash2, Save, ArrowLeft, Printer } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Toggle, Modal, PageLoader, EmptyState, ErrorState, StatusBadge, Stat } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { inr } from '../../lib/format';
import { downloadFile } from '../../lib/download';
import { amountInWords } from '../../lib/gst';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function PayrollRuns() {
  const can = useCan();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [f, setF] = useState({ month: now.getMonth() || 12, year: now.getMonth() ? now.getFullYear() : now.getFullYear() - 1 });
  const { data, isLoading, error, refetch } = useApiQuery('payroll-runs', '/company/payroll/runs');
  const create = useApiMutation({ path: '/company/payroll/runs', invalidate: ['payroll-runs'], success: 'Payroll calculated', onSuccess: (r) => navigate(`/app/payroll/runs/${r.data._id}`) });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <>
      <PageHeader title="Payroll" description="Monthly payroll runs with statutory deductions and payslips."
        actions={<><Link to="/app/payroll/settings"><Button variant="secondary">Statutory settings</Button></Link>{can('payroll.payroll.create') && <Button icon={Plus} onClick={() => setOpen(true)}>Run payroll</Button>}</>} />
      <Card>{!data.data.length ? <EmptyState title="No payroll runs yet" description="Add salary structures to employees, then run payroll for a month." /> : (
        <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Period', 'Employees', 'Gross', 'Deductions', 'Net pay', 'Employer cost', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((r) => (
            <tr key={r._id} className="hover:bg-soft-50 dark:hover:bg-white/5"><td className="td"><Link className="font-semibold text-royal-600 dark:text-electric-400" to={`/app/payroll/runs/${r._id}`}>{MONTHS[r.month - 1]} {r.year}</Link></td>
              <td className="td">{r.totals?.employees}</td><td className="td">{inr(r.totals?.gross)}</td><td className="td">{inr(r.totals?.deductions)}</td><td className="td font-semibold">{inr(r.totals?.net)}</td><td className="td">{inr(r.totals?.employerCost)}</td><td className="td"><StatusBadge status={r.status} /></td></tr>))}</tbody></table></div>)}</Card>
      {open && <Modal open onClose={() => setOpen(false)} title="Run payroll" description="Calculates payslips for all active employees using attendance overtime and unpaid leave."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate({ body: f })}>Calculate</Button></>}>
        <div className="grid grid-cols-2 gap-4"><Select label="Month" value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
          <Input label="Year" type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} /></div></Modal>}
    </>
  );
}

function EditSlip({ slip, onClose }) {
  const [f, setF] = useState({ ...slip.inputs });
  const m = useApiMutation({ method: 'PATCH', path: `/company/payroll/payslips/${slip._id}`, invalidate: ['payroll-run', 'payroll-runs'], success: 'Payslip recalculated', onSuccess: onClose });
  const fld = (k, l) => <Input key={k} label={l} type="number" value={f[k] ?? 0} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return <Modal open onClose={onClose} title={`Adjust — ${slip.employeeSnapshot.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => m.mutate({ body: Object.fromEntries(['paidDays', 'overtimeHours', 'bonus', 'incentive', 'advanceRecovery', 'otherDeductions'].map((k) => [k, Number(f[k]) || 0])) })}>Recalculate</Button></>}>
    <div className="grid gap-4 sm:grid-cols-2">{fld('paidDays', `Paid days (of ${f.totalDays})`)}{fld('overtimeHours', 'Overtime hours')}{fld('bonus', 'Bonus (₹)')}{fld('incentive', 'Incentive (₹)')}{fld('advanceRecovery', 'Salary advance recovery (₹)')}{fld('otherDeductions', 'Other deductions (₹)')}</div></Modal>;
}

export function PayrollRun() {
  const { id } = useParams();
  const can = useCan();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(null);
  const { data, isLoading, error, refetch } = useApiQuery(['payroll-run', id], `/company/payroll/runs/${id}`);
  const act = useApiMutation({ invalidate: ['payroll-run', 'payroll-runs'], success: 'Payroll updated' });
  const del = useApiMutation({ method: 'DELETE', invalidate: ['payroll-runs'], success: 'Draft deleted', onSuccess: () => navigate('/app/payroll') });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { run, payslips } = data.data;
  return (
    <>
      <Link to="/app/payroll" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" />All runs</Link>
      <PageHeader title={`Payroll — ${MONTHS[run.month - 1]} ${run.year}`} description={<StatusBadge status={run.status} />} actions={<>
        {can('payroll.payroll.export') && <Button variant="secondary" icon={Download} onClick={() => downloadFile(`/company/payroll/runs/${id}/export.csv`, `payroll-${run.year}-${run.month}.csv`)}>Bank transfer CSV</Button>}
        {run.status === 'draft' && can('payroll.payroll.edit') && <Button variant="ghost" icon={Trash2} onClick={() => window.confirm('Delete this draft run?') && del.mutate({ path: `/company/payroll/runs/${id}` })}>Delete</Button>}
        {run.status === 'draft' && can('payroll.payroll.approve') && <Button icon={CheckCircle2} onClick={() => window.confirm('Approve payroll? Payslips will be published to employees.') && act.mutate({ path: `/company/payroll/runs/${id}/approve` })}>Approve</Button>}
        {run.status === 'approved' && can('payroll.payroll.approve') && <Button icon={Banknote} onClick={() => act.mutate({ path: `/company/payroll/runs/${id}/mark-paid` })}>Mark as paid</Button>}
      </>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4"><Stat label="Employees" value={run.totals.employees} /><Stat label="Gross" value={inr(run.totals.gross)} /><Stat label="Deductions" value={inr(run.totals.deductions)} tone="amber" /><Stat label="Net pay" value={inr(run.totals.net)} tone="green" /></div>
      <Card><div className="overflow-x-auto"><table className="w-full min-w-[860px]"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Employee', 'Paid days', 'Gross', 'PF', 'ESI', 'PT', 'TDS', 'Net pay', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-soft-200 dark:divide-white/10">{payslips.map((p) => {
          const d = (n) => inr(p.deductions.find((x) => x.name === n)?.amount || 0);
          return <tr key={p._id}><td className="td"><p className="font-medium">{p.employeeSnapshot.name}</p><p className="text-xs text-slate-500">{p.employeeSnapshot.employeeId} · {p.employeeSnapshot.designation}</p></td>
            <td className="td">{p.paidDays}/{p.totalDays}</td><td className="td">{inr(p.gross)}</td><td className="td">{d('Provident Fund')}</td><td className="td">{d('ESI')}</td><td className="td">{d('Professional Tax')}</td><td className="td">{d('TDS')}</td>
            <td className="td font-semibold">{inr(p.netPay)}</td><td className="td"><div className="flex gap-1">{run.status === 'draft' && can('payroll.payroll.edit') && <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>Adjust</Button>}<Link to={`/app/payroll/payslips/${p._id}`}><Button size="sm" variant="ghost" icon={Printer} /></Link></div></td></tr>;
        })}</tbody></table></div></Card>
      {edit && <EditSlip slip={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

export function PayslipView() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useApiQuery(['payslip', id], `/company/payroll/payslips/${id}`);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { payslip: p, company: c } = data.data;
  const rows = Math.max(p.earnings.length, p.deductions.length);
  return (
    <>
      <div className="mb-4 flex justify-end print:hidden"><Button icon={Printer} onClick={() => window.print()}>Print / PDF</Button></div>
      <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-slate-800 shadow-sm print:shadow-none">
        <div className="border-b-2 border-navy-900 pb-4 text-center"><h2 className="text-xl font-extrabold text-navy-900">{c.name}</h2><p className="text-slate-500">{[c.address?.line1, c.address?.city, c.address?.state].filter(Boolean).join(', ')}</p>
          <p className="mt-2 font-bold uppercase tracking-wide text-royal-700">Payslip for {MONTHS[p.month - 1]} {p.year}</p></div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4">{[['Employee', p.employeeSnapshot.name], ['Employee ID', p.employeeSnapshot.employeeId], ['Designation', p.employeeSnapshot.designation], ['Department', p.employeeSnapshot.department], ['UAN', p.employeeSnapshot.uan], ['Bank A/c', p.employeeSnapshot.bankAccount], ['Paid days', `${p.paidDays} / ${p.totalDays}`], ['LOP days', p.lopDays]].map(([l, v]) => <p key={l}><span className="text-slate-500">{l}:</span> <b>{v || '—'}</b></p>)}</div>
        <table className="w-full border border-slate-200"><thead><tr className="bg-navy-900 text-white"><th className="px-3 py-2 text-left">Earnings</th><th className="px-3 py-2 text-right">₹</th><th className="px-3 py-2 text-left">Deductions</th><th className="px-3 py-2 text-right">₹</th></tr></thead>
          <tbody>{Array.from({ length: rows }).map((_, i) => <tr key={i} className="border-b border-slate-100"><td className="px-3 py-1.5">{p.earnings[i]?.name}</td><td className="px-3 py-1.5 text-right">{p.earnings[i] && inr(p.earnings[i].amount, { maximumFractionDigits: 2 })}</td><td className="px-3 py-1.5">{p.deductions[i]?.name}</td><td className="px-3 py-1.5 text-right">{p.deductions[i] && inr(p.deductions[i].amount, { maximumFractionDigits: 2 })}</td></tr>)}
            <tr className="bg-soft-50 font-bold"><td className="px-3 py-2">Gross earnings</td><td className="px-3 py-2 text-right">{inr(p.gross, { maximumFractionDigits: 2 })}</td><td className="px-3 py-2">Total deductions</td><td className="px-3 py-2 text-right">{inr(p.totalDeductions, { maximumFractionDigits: 2 })}</td></tr></tbody></table>
        <div className="mt-4 rounded-lg bg-navy-900 p-4 text-white"><p className="text-xs uppercase text-white/60">Net pay</p><p className="text-2xl font-extrabold">{inr(p.netPay, { maximumFractionDigits: 2 })}</p><p className="text-xs text-white/70">{amountInWords(p.netPay)}</p></div>
        <p className="mt-4 text-xs text-slate-500">Employer contributions — PF: {inr(p.employer?.pf)} · ESI: {inr(p.employer?.esi)}. This is a computer-generated payslip and does not require a signature.</p>
      </div>
    </>
  );
}

export function PayrollSettings() {
  const can = useCan();
  const { data, isLoading } = useApiQuery('payroll-settings', '/company/payroll/settings');
  const [f, setF] = useState(null);
  const save = useApiMutation({ method: 'PATCH', path: '/company/payroll/settings', invalidate: ['payroll-settings'], success: 'Payroll settings saved' });
  useEffect(() => { if (data) setF(data.data); }, [data]);
  if (isLoading || !f) return <PageLoader />;
  const n = (k, l) => <Input label={l} type="number" step="any" value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />;
  const tg = (k, l) => <Toggle label={l} checked={!!f[k]} onChange={(v) => setF({ ...f, [k]: v })} />;
  const { _id, ...body } = f;
  return (
    <>
      <PageHeader title="Statutory payroll settings" description="Rates and ceilings are configurable so you can update them whenever rules change. Confirm current rates with your payroll consultant."
        actions={can('payroll.payroll.approve') && <Button icon={Save} loading={save.isPending} onClick={() => save.mutate({ body })}>Save</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2">{tg('pfEnabled', 'Provident Fund (PF)')}{tg('pfApplyCeiling', 'Apply PF wage ceiling')}</div>{n('pfEmployeeRate', 'Employee rate %')}{n('pfEmployerRate', 'Employer rate %')}{n('pfWageCeiling', 'Wage ceiling (₹)')}</Card>
        <Card className="grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2">{tg('esiEnabled', 'Employees’ State Insurance (ESI)')}</div>{n('esiEmployeeRate', 'Employee rate %')}{n('esiEmployerRate', 'Employer rate %')}{n('esiWageLimit', 'Eligibility wage limit (₹)')}</Card>
        <Card className="space-y-3 p-6">{tg('ptEnabled', 'Professional Tax (PT)')}<p className="text-xs text-slate-500">Monthly slabs on gross pay. Leave “up to” empty for the top slab.</p>
          {(f.ptSlabs || []).map((s, i) => <div key={i} className="flex gap-2"><Input placeholder="Up to ₹ (empty = above)" type="number" value={s.upTo ?? ''} onChange={(e) => setF({ ...f, ptSlabs: f.ptSlabs.map((x, j) => (j === i ? { ...x, upTo: e.target.value === '' ? null : Number(e.target.value) } : x)) })} />
            <Input placeholder="PT ₹" type="number" value={s.amount} onChange={(e) => setF({ ...f, ptSlabs: f.ptSlabs.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)) })} />
            <Button variant="ghost" icon={Trash2} onClick={() => setF({ ...f, ptSlabs: f.ptSlabs.filter((_, j) => j !== i) })} /></div>)}
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setF({ ...f, ptSlabs: [...(f.ptSlabs || []), { upTo: null, amount: 0 }] })}>Add slab</Button></Card>
        <Card className="grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2">{tg('tdsEnabled', 'Deduct TDS (amount set per employee)')}</div>{n('overtimeMultiplier', 'Overtime multiplier (× hourly)')}
          <Select label="Working days" value={f.workingDaysMode} onChange={(e) => setF({ ...f, workingDaysMode: e.target.value })}><option value="calendar">Calendar days of month</option><option value="fixed">Fixed days</option></Select>
          {f.workingDaysMode === 'fixed' && n('fixedWorkingDays', 'Fixed working days')}</Card>
      </div>
    </>
  );
}
