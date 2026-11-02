import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Lock, Pencil, Trash2, Eye, ShieldCheck } from 'lucide-react';
import { Card, PageHeader, Button, Modal, Input, Badge, PageLoader, ErrorState, cx } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan, hasModule } from '../../lib/permissions';
import { useAuth } from '../../store/auth';
import { titleCase } from '../../lib/format';

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'download', 'manage', 'configure'];

function toMatrix(permissions, resources) {
  const m = {};
  const all = permissions.some((p) => p.key === '*');
  for (const r of resources) {
    const id = `${r.module}.${r.resource}`;
    m[id] = { scope: 'company', actions: new Set() };
    for (const a of r.actions) {
      const p = all ? { scope: 'company' } : permissions.find((x) => x.key === `${id}.${a}`);
      if (p) { m[id].actions.add(a); m[id].scope = p.scope; }
    }
  }
  return m;
}

function RoleEditor({ role, catalog, readOnly, onClose }) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [matrix, setMatrix] = useState(() => toMatrix(role?.permissions || [], catalog.resources));
  const save = useApiMutation({ method: role ? 'PATCH' : 'POST', path: role ? `/company/roles/${role._id}` : '/company/roles', invalidate: ['company-roles'], success: 'Role saved', onSuccess: onClose });
  const grouped = useMemo(() => Object.entries(catalog.modules).map(([key, m]) => ({ key, label: m.label, enabled: m.alwaysOn || catalog.planModules.includes(key), resources: catalog.resources.filter((r) => r.module === key) })).filter((g) => g.resources.length), [catalog]);

  const toggle = (id, a) => setMatrix((m) => {
    const actions = new Set(m[id].actions);
    actions.has(a) ? actions.delete(a) : actions.add(a);
    return { ...m, [id]: { ...m[id], actions } };
  });
  const setScope = (id, scope) => setMatrix((m) => ({ ...m, [id]: { ...m[id], scope } }));
  const submit = () => {
    const permissions = Object.entries(matrix).flatMap(([id, v]) => [...v.actions].map((a) => ({ key: `${id}.${a}`, scope: v.scope })));
    save.mutate({ body: { name, description, permissions } });
  };
  const count = Object.values(matrix).reduce((n, v) => n + v.actions.size, 0);

  return (
    <Modal open onClose={onClose} size="xl" title={readOnly ? role.name : role ? `Edit ${role.name}` : 'Create custom role'} description={`${count} permission(s) selected. Permissions are enforced on the server for every request.`}
      footer={readOnly ? <Button variant="secondary" onClick={onClose}>Close</Button> : <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={submit} disabled={name.trim().length < 2}>Save role</Button></>}>
      {!readOnly && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Input label="Role name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Store Manager" />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      )}
      <div className="space-y-6">
        {grouped.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-bold text-navy-900 dark:text-white">{g.label}</h3>{!g.enabled && <Badge color="amber"><Lock className="h-3 w-3" />Not in plan</Badge>}</div>
            <div className="overflow-x-auto rounded-xl border border-soft-200 dark:border-white/10">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-soft-50 dark:bg-white/5"><tr><th className="th">Resource</th>{ACTIONS.map((a) => <th key={a} className="th text-center">{a}</th>)}<th className="th">Scope</th></tr></thead>
                <tbody className="divide-y divide-soft-200 dark:divide-white/10">
                  {g.resources.map((r) => {
                    const id = `${r.module}.${r.resource}`;
                    const row = matrix[id];
                    return (
                      <tr key={id}>
                        <td className="td font-medium">{r.label}</td>
                        {ACTIONS.map((a) => (
                          <td key={a} className="td text-center">
                            {r.actions.includes(a) ? (
                              <input type="checkbox" disabled={readOnly} checked={row.actions.has(a)} onChange={() => toggle(id, a)} className="h-4 w-4 cursor-pointer rounded accent-royal-600" aria-label={`${r.label} ${a}`} />
                            ) : <span className="text-slate-300">·</span>}
                          </td>
                        ))}
                        <td className="td">
                          <select disabled={readOnly || !row.actions.size} value={row.scope} onChange={(e) => setScope(id, e.target.value)} className="input py-1 text-xs">
                            {catalog.scopes.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function Roles() {
  const can = useCan();
  const session = useAuth((s) => s.session);
  const custom = hasModule(session, 'customRoles');
  const { data, isLoading, error, refetch } = useApiQuery('company-roles', '/company/roles');
  const { data: catalog } = useApiQuery('company-permissions', '/company/permissions');
  const [editor, setEditor] = useState(null); // { role, readOnly }
  const remove = useApiMutation({ method: 'DELETE', invalidate: ['company-roles'], success: 'Role deleted' });

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="Roles & permissions" description="Control exactly what each person can see and do."
        actions={custom && can('core.role.create') && <Button icon={Plus} disabled={!catalog} onClick={() => setEditor({ role: null })}>Create role</Button>} />
      {!custom && (
        <Card className="mb-6 flex flex-col items-start justify-between gap-4 border-royal-600/20 bg-royal-600/5 p-5 sm:flex-row sm:items-center">
          <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-royal-600" /><p className="text-sm">Your plan includes the default roles below. <b>Custom roles and editable permissions</b> are available on Business and Enterprise plans.</p></div>
          {can('core.subscription.view') && <Link to="/app/subscription"><Button size="sm">See plans</Button></Link>}
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.data.map((r) => {
          const editable = custom && !r.locked && can('core.role.edit');
          return (
            <Card key={r._id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-bold text-navy-900 dark:text-white">{r.name}</h2><p className="text-xs text-slate-500">{r.users} user(s)</p></div>
                <div className="flex gap-1">{r.isSystem && <Badge>Default</Badge>}{r.locked && <Badge color="violet"><Lock className="h-3 w-3" />Locked</Badge>}</div>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-500">{r.description || '—'}</p>
              <p className="mt-3 text-xs text-slate-500">{r.permissions.some((p) => p.key === '*') ? 'All permissions' : `${r.permissions.length} permissions`}</p>
              <div className={cx('mt-4 flex gap-2')}>
                <Button size="sm" variant="secondary" icon={editable ? Pencil : Eye} disabled={!catalog} onClick={() => setEditor({ role: r, readOnly: !editable })} className="flex-1">{editable ? 'Edit' : 'View'}</Button>
                {editable && can('core.role.delete') && !r.users && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => window.confirm(`Delete role "${r.name}"?`) && remove.mutate({ path: `/company/roles/${r._id}` })} aria-label="Delete" />}
              </div>
            </Card>
          );
        })}
      </div>
      {editor && catalog && <RoleEditor role={editor.role} readOnly={editor.readOnly} catalog={catalog.data} onClose={() => setEditor(null)} />}
    </>
  );
}
