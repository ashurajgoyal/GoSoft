import { useState } from 'react';
import { Plus, Search, Pencil, Trash2, Download, Inbox } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, PageHeader, Button, Modal, Input, Select, Textarea, Toggle, Pagination, PageLoader, EmptyState, ErrorState } from './ui';
import { useApiQuery, useApiMutation } from '../lib/hooks';
import { useCan } from '../lib/permissions';
import { api } from '../lib/api';
import { getPath, setPath, toDateInput } from '../lib/obj';
import { downloadFile } from '../lib/download';

function RefSelect({ field, value, onChange }) {
  const { data } = useQuery({ queryKey: ['ref', field.endpoint], queryFn: () => api(field.endpoint, { query: { limit: 500 } }) });
  const items = data?.data || [];
  const label = field.optionLabel || ((x) => x.name || x.title || [x.firstName, x.lastName].filter(Boolean).join(' '));
  if (field.multiple) {
    const vals = (value || []).map((v) => (typeof v === 'object' ? v._id : v));
    return (
      <div><span className="label">{field.label}</span>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-soft-200 p-2 dark:border-white/10">
          {items.map((x) => {
            const on = vals.includes(x._id);
            return <button type="button" key={x._id} onClick={() => onChange(on ? vals.filter((v) => v !== x._id) : [...vals, x._id])}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${on ? 'bg-royal-600 text-white' : 'bg-soft-100 dark:bg-white/10'}`}>{label(x)}</button>;
          })}
          {!items.length && <span className="text-xs text-slate-500">Nothing to select yet</span>}
        </div>
      </div>
    );
  }
  return (
    <Select label={field.label} value={(typeof value === 'object' ? value?._id : value) || ''} onChange={(e) => onChange(e.target.value || null)} required={field.required}>
      <option value="">{field.placeholder || 'Select'}</option>
      {items.map((x) => <option key={x._id} value={x._id}>{label(x)}</option>)}
    </Select>
  );
}

export function FieldInput({ field, values, setValues }) {
  const value = getPath(values, field.name);
  const set = (v) => setValues((s) => setPath(s, field.name, v));
  const common = { label: field.label, required: field.required, placeholder: field.placeholder };
  switch (field.type) {
    case 'select': return <Select {...common} value={value ?? ''} onChange={(e) => set(e.target.value)}>{!field.required && <option value="">—</option>}{field.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}</Select>;
    case 'ref': return <RefSelect field={field} value={value} onChange={set} />;
    case 'textarea': return <Textarea {...common} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'checkbox': return <Toggle label={field.label} checked={!!value} onChange={set} />;
    case 'date': return <Input {...common} type="date" value={toDateInput(value)} onChange={(e) => set(e.target.value)} />;
    case 'number': return <Input {...common} type="number" step="any" value={value ?? ''} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'tags': return <Input {...common} hint="Comma separated" value={(value || []).join(', ')} onChange={(e) => set(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />;
    default: return <Input {...common} type={field.type || 'text'} value={value ?? ''} onChange={(e) => set(field.upper ? e.target.value.toUpperCase() : e.target.value)} maxLength={field.maxLength} />;
  }
}

export function ResourceForm({ title, endpoint, item, fields, defaults = {}, invalidate, onClose, transformIn }) {
  const [values, setValues] = useState(() => item ? { ...item } : { ...defaults });
  const m = useApiMutation({ method: item ? 'PATCH' : 'POST', path: item ? `${endpoint}/${item._id}` : endpoint, invalidate, success: 'Saved', onSuccess: onClose });
  const submit = (e) => {
    e?.preventDefault();
    const body = {};
    for (const f of fields) {
      if (f.readOnly) continue;
      let v = getPath(values, f.name);
      if (f.type === 'ref') v = Array.isArray(v) ? v.map((x) => x?._id || x) : (v?._id || v || null);
      const top = f.name.split('.')[0];
      if (f.name.includes('.')) body[top] = { ...(body[top] || values[top] || {}), ...setPath({}, f.name, v)[top] };
      else body[f.name] = v === '' ? undefined : v;
    }
    m.mutate({ body: transformIn ? transformIn(body, values) : body });
  };
  return (
    <Modal open onClose={onClose} size={fields.length > 8 ? 'lg' : 'md'} title={`${item ? 'Edit' : 'New'} ${title}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={submit}>Save</Button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (f.section
          ? <h3 key={f.section} className="mt-2 text-sm font-bold text-navy-900 sm:col-span-2 dark:text-white">{f.section}</h3>
          : <div key={f.name} className={f.full || ['textarea', 'tags'].includes(f.type) || (f.type === 'ref' && f.multiple) ? 'sm:col-span-2' : ''}><FieldInput field={f} values={values} setValues={setValues} /></div>))}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/**
 * Config-driven list + create/edit/delete page for simple resources.
 * columns: [{ key, label, render(row) }]; fields: form field configs (see FieldInput).
 */
export default function ResourcePage({ title, singular, description, endpoint, perm, columns, fields, defaults, filters = [], csv, rowActions, headerActions, transformIn, emptyText }) {
  const can = useCan();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState({});
  const [editing, setEditing] = useState(undefined);
  const key = ['res', endpoint];
  const { data, isLoading, error, refetch } = useApiQuery(key, endpoint, { q, page, ...filterValues });
  const remove = useApiMutation({ method: 'DELETE', invalidate: [key], success: 'Deleted' });
  const canEdit = !perm || can(`${perm}.edit`);
  const canDelete = !perm || can(`${perm}.delete`);

  return (
    <>
      <PageHeader title={title} description={description} actions={<>
        {headerActions}
        {csv && (!perm || can(`${perm}.export`)) && <Button variant="secondary" icon={Download} onClick={() => downloadFile(`${endpoint}/export.csv`, `${singular || title}.csv`)}>Export CSV</Button>}
        {fields && (!perm || can(`${perm}.create`)) && <Button icon={Plus} onClick={() => setEditing(null)}>Add {singular || title}</Button>}
      </>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-soft-200 p-4 dark:border-white/10 md:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          {filters.map((f) => (
            <Select key={f.name} value={filterValues[f.name] || 'all'} onChange={(e) => { setFilterValues({ ...filterValues, [f.name]: e.target.value }); setPage(1); }} className="md:w-44">
              <option value="all">{f.label}: All</option>{f.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
            </Select>
          ))}
        </div>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data.data.length ? <EmptyState icon={Inbox} title={`No ${title.toLowerCase()} yet`} description={emptyText} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
            <thead className="border-b border-soft-200 dark:border-white/10"><tr>{columns.map((c) => <th key={c.key || c.label} className="th">{c.label}</th>)}<th className="th" /></tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">
              {data.data.map((row) => (
                <tr key={row._id} className="hover:bg-soft-50 dark:hover:bg-white/5">
                  {columns.map((c) => <td key={c.key || c.label} className="td">{c.render ? c.render(row) : getPath(row, c.key) ?? '—'}</td>)}
                  <td className="td"><div className="flex justify-end gap-1">
                    {rowActions?.(row)}
                    {fields && canEdit && <button onClick={() => setEditing(row)} className="rounded-lg p-1.5 text-slate-500 hover:bg-soft-100 dark:hover:bg-white/10" aria-label="Edit"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => window.confirm('Delete this record?') && remove.mutate({ path: `${endpoint}/${row._id}` })} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
      {editing !== undefined && <ResourceForm title={singular || title} endpoint={endpoint} item={editing} fields={fields} defaults={defaults} invalidate={[key]} transformIn={transformIn} onClose={() => setEditing(undefined)} />}
    </>
  );
}
