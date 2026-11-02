import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Search, Users as UsersIcon, MoreHorizontal, Mail, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import { Card, PageHeader, Button, Modal, Input, Select, StatusBadge, Pagination, PageLoader, EmptyState, ErrorState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { useAuth } from '../../store/auth';
import { dateTime, initials, limitLabel } from '../../lib/format';

function UserForm({ user, roles, users, onClose }) {
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', role: user?.role?._id || roles.find((r) => r.slug === 'employee')?._id || '', manager: user?.manager?._id || '', designation: user?.designation || '', department: user?.department || '' });
  const m = useApiMutation({ method: user ? 'PATCH' : 'POST', path: user ? `/company/users/${user._id}` : '/company/users', invalidate: ['company-users', 'company-dashboard'], success: user ? 'User updated' : 'Invitation sent', onSuccess: onClose });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const body = { ...f };
    if (user) { delete body.email; body.manager = f.manager || null; }
    else if (!body.manager) delete body.manager;
    m.mutate({ body });
  };
  return (
    <Modal open onClose={onClose} title={user ? 'Edit user' : 'Invite a user'} description={user ? undefined : 'They will receive an email to set their password.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={submit}>{user ? 'Save' : 'Send invitation'}</Button></>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={f.name} onChange={set('name')} />
        <Input label="Email" type="email" required disabled={!!user} value={f.email} onChange={set('email')} />
        <Input label="Phone" value={f.phone} onChange={set('phone')} />
        <Select label="Role" value={f.role} onChange={set('role')}>{roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}</Select>
        <Input label="Designation" value={f.designation} onChange={set('designation')} />
        <Input label="Department" value={f.department} onChange={set('department')} />
        <Select label="Reporting manager" value={f.manager} onChange={set('manager')} className="sm:col-span-2">
          <option value="">None</option>{users.filter((u) => u._id !== user?._id).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </Select>
      </form>
    </Modal>
  );
}

function RowMenu({ u, onEdit, me }) {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const status = useApiMutation({ method: 'PATCH', invalidate: ['company-users', 'company-dashboard'], success: 'Status updated' });
  const resend = useApiMutation({ success: 'Invitation re-sent' });
  const remove = useApiMutation({ method: 'DELETE', invalidate: ['company-users', 'company-dashboard'], success: 'User removed' });
  if (u._id === me) return null;
  const act = (fn) => { setOpen(false); fn(); };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="rounded-lg p-1.5 hover:bg-soft-100 dark:hover:bg-white/10" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="card absolute right-0 z-20 mt-1 w-48 p-1 shadow-xl">
          {can('core.user.edit') && <button onClick={() => act(onEdit)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-soft-100 dark:hover:bg-white/5"><Pencil className="h-4 w-4" />Edit</button>}
          {u.status === 'invited' && can('core.user.create') && <button onClick={() => act(() => resend.mutate({ path: `/company/users/${u._id}/resend-invite` }))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-soft-100 dark:hover:bg-white/5"><Mail className="h-4 w-4" />Resend invite</button>}
          {can('core.user.manage') && u.status !== 'invited' && <button onClick={() => act(() => status.mutate({ path: `/company/users/${u._id}/status`, body: { status: u.status === 'active' ? 'inactive' : 'active' } }))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-soft-100 dark:hover:bg-white/5">{u.status === 'active' ? <><UserX className="h-4 w-4" />Deactivate</> : <><UserCheck className="h-4 w-4" />Activate</>}</button>}
          {can('core.user.delete') && <button onClick={() => act(() => window.confirm(`Remove ${u.name}? Their history stays in the audit log.`) && remove.mutate({ path: `/company/users/${u._id}` }))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" />Remove</button>}
        </div>
      </>)}
    </div>
  );
}

export default function Users() {
  const can = useCan();
  const session = useAuth((s) => s.session);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(undefined);
  const { data, isLoading, error, refetch } = useApiQuery('company-users', '/company/users', { q, status, page });
  const { data: roles } = useApiQuery('company-roles', '/company/roles', undefined, { enabled: can('core.role.view') });
  const { data: all } = useApiQuery('company-users', '/company/users', { limit: 100 });

  useEffect(() => { if (params.get('invite') && roles) { setForm(null); setParams({}, { replace: true }); } }, [params, roles, setParams]);

  return (
    <>
      <PageHeader title="Users" description={`${limitLabel(session.limits?.users)} seats on your ${session.subscription?.plan?.name || ''} plan.`}
        actions={can('core.user.create') && <Button icon={UserPlus} onClick={() => setForm(null)} disabled={!roles}>Invite user</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-soft-200 p-4 dark:border-white/10 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search name, email, designation" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-40">{['all', 'active', 'invited', 'inactive'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}</Select>
        </div>
        {isLoading ? <PageLoader /> : error ? <ErrorState error={error} onRetry={refetch} /> : data.data.length === 0 ? <EmptyState icon={UsersIcon} title="No users found" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px]">
            <thead className="border-b border-soft-200 dark:border-white/10"><tr>{['User', 'Role', 'Designation', 'Manager', 'Status', 'Last login', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">
              {data.data.map((u) => (
                <tr key={u._id} className="hover:bg-soft-50 dark:hover:bg-white/5">
                  <td className="td"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-royal-600/10 text-xs font-bold text-royal-700 dark:text-electric-300">{initials(u.name)}</span><div><p className="font-medium">{u.name}{u._id === session.user._id && <span className="ml-1 text-xs text-slate-500">(you)</span>}</p><p className="text-xs text-slate-500">{u.email}</p></div></div></td>
                  <td className="td">{u.role?.name}</td>
                  <td className="td">{u.designation || '—'}{u.department && <p className="text-xs text-slate-500">{u.department}</p>}</td>
                  <td className="td">{u.manager?.name || '—'}</td>
                  <td className="td"><StatusBadge status={u.status} /></td>
                  <td className="td text-slate-500">{dateTime(u.lastLoginAt)}</td>
                  <td className="td"><RowMenu u={u} me={session.user._id} onEdit={() => setForm(u)} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
      {form !== undefined && roles && <UserForm user={form} roles={roles.data} users={all?.data || []} onClose={() => setForm(undefined)} />}
    </>
  );
}
