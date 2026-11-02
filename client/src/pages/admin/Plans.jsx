import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, Check } from 'lucide-react';
import { Card, PageHeader, Button, Modal, Input, Textarea, Toggle, Badge, PageLoader, ErrorState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { inr, limitLabel } from '../../lib/format';

const EMPTY = { name: '', tagline: '', description: '', priceMonthly: 0, priceAnnual: 0, trialDays: 14, limits: { users: 5, employees: 10, invoicesPerMonth: 100, storageMB: 1024, branches: 1 }, modules: [], features: [], highlighted: false, isPublic: true, sortOrder: 10 };

function PlanEditor({ plan, modules, onClose }) {
  const [f, setF] = useState(() => ({ ...EMPTY, ...plan, limits: { ...EMPTY.limits, ...plan?.limits }, featuresText: (plan?.features || []).join('\n') }));
  const save = useApiMutation({ method: plan ? 'PATCH' : 'POST', path: plan ? `/admin/plans/${plan._id}` : '/admin/plans', invalidate: ['admin-plans', 'public-plans'], success: 'Plan saved', onSuccess: onClose });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleModule = (k) => set('modules', f.modules.includes(k) ? f.modules.filter((m) => m !== k) : [...f.modules, k]);
  const submit = () => save.mutate({ body: {
    name: f.name, tagline: f.tagline, description: f.description, priceMonthly: Number(f.priceMonthly), priceAnnual: Number(f.priceAnnual), trialDays: Number(f.trialDays),
    limits: Object.fromEntries(Object.entries(f.limits).map(([k, v]) => [k, Number(v)])), modules: f.modules,
    features: f.featuresText.split('\n').map((s) => s.trim()).filter(Boolean), highlighted: f.highlighted, isPublic: f.isPublic, sortOrder: Number(f.sortOrder),
  } });

  return (
    <Modal open onClose={onClose} size="lg" title={plan ? `Edit ${plan.name}` : 'New plan'} description="Changes apply to all companies on this plan immediately."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={submit}>Save plan</Button></>}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Plan name" value={f.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Tagline" value={f.tagline || ''} onChange={(e) => set('tagline', e.target.value)} />
          <Input label="Monthly price (₹, excl. GST)" type="number" min={0} value={f.priceMonthly} onChange={(e) => set('priceMonthly', e.target.value)} />
          <Input label="Annual price (₹, excl. GST)" type="number" min={0} value={f.priceAnnual} onChange={(e) => set('priceAnnual', e.target.value)} />
          <Input label="Trial days" type="number" min={0} value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} />
          <Input label="Sort order" type="number" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Limits <span className="font-normal text-slate-500">(-1 = unlimited)</span></h3>
          <div className="grid gap-4 sm:grid-cols-5">
            {[['users', 'Users'], ['employees', 'Employees'], ['invoicesPerMonth', 'Invoices/mo'], ['storageMB', 'Storage MB'], ['branches', 'Branches']].map(([k, l]) => (
              <Input key={k} label={l} type="number" min={-1} value={f.limits[k]} onChange={(e) => set('limits', { ...f.limits, [k]: e.target.value })} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Module access</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(modules).filter(([, m]) => !m.alwaysOn).map(([k, m]) => (
              <button type="button" key={k} onClick={() => toggleModule(k)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${f.modules.includes(k) ? 'border-royal-600 bg-royal-600/5 text-royal-700 dark:text-electric-300' : 'border-soft-200 dark:border-white/10'}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded ${f.modules.includes(k) ? 'bg-royal-600 text-white' : 'border border-slate-300'}`}>{f.modules.includes(k) && <Check className="h-3 w-3" />}</span>{m.label}
              </button>
            ))}
          </div>
        </div>
        <Textarea label="Marketing features (one per line)" value={f.featuresText} onChange={(e) => set('featuresText', e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Highlight as most popular" checked={f.highlighted} onChange={(v) => set('highlighted', v)} />
          <Toggle label="Show on public pricing page" checked={f.isPublic} onChange={(v) => set('isPublic', v)} />
        </div>
      </div>
    </Modal>
  );
}

export default function Plans() {
  const { data, isLoading, error, refetch } = useApiQuery('admin-plans', '/admin/plans');
  const { data: meta } = useApiQuery('admin-meta', '/admin/meta');
  const [editing, setEditing] = useState(undefined);
  const archive = useApiMutation({ method: 'PATCH', invalidate: ['admin-plans', 'public-plans'], success: 'Plan updated' });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const modules = meta?.data?.modules || {};

  return (
    <>
      <PageHeader title="Subscription plans" description="Pricing, trial length, limits and module access for every plan." actions={<Button icon={Plus} onClick={() => setEditing(null)}>New plan</Button>} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {data.data.map((p) => (
          <Card key={p._id} className={`flex flex-col p-5 ${p.isArchived ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div><h2 className="text-lg font-bold text-navy-900 dark:text-white">{p.name}</h2><p className="text-xs text-slate-500">{p.subscribers} subscriber(s)</p></div>
              <div className="flex gap-1">{p.highlighted && <Badge color="blue">Popular</Badge>}{p.isArchived && <Badge>Archived</Badge>}{!p.isPublic && <Badge color="violet">Hidden</Badge>}</div>
            </div>
            <p className="mt-4 font-display text-2xl font-extrabold">{inr(p.priceMonthly)}<span className="text-sm font-medium text-slate-500">/mo</span></p>
            <p className="text-xs text-slate-500">{inr(p.priceAnnual)}/yr · {p.trialDays}-day trial</p>
            <dl className="mt-4 space-y-1.5 text-sm">
              {[['Users', 'users'], ['Employees', 'employees'], ['Invoices/mo', 'invoicesPerMonth'], ['Storage', 'storageMB']].map(([l, k]) => (
                <div key={k} className="flex justify-between"><dt className="text-slate-500">{l}</dt><dd className="font-medium">{limitLabel(p.limits?.[k])}{k === 'storageMB' && p.limits?.[k] !== -1 && ' MB'}</dd></div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-1">{p.modules.map((m) => <Badge key={m} color="blue">{modules[m]?.label?.split(' (')[0] || m}</Badge>)}</div>
            <div className="mt-auto flex gap-2 pt-5">
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(p)} className="flex-1">Edit</Button>
              <Button size="sm" variant="ghost" icon={p.isArchived ? ArchiveRestore : Archive} onClick={() => archive.mutate({ path: `/admin/plans/${p._id}/archive`, body: { archived: !p.isArchived } })}>{p.isArchived ? 'Restore' : 'Archive'}</Button>
            </div>
          </Card>
        ))}
      </div>
      {editing !== undefined && <PlanEditor plan={editing} modules={modules} onClose={() => setEditing(undefined)} />}
    </>
  );
}
