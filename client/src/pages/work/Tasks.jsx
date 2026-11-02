import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, LayoutGrid, List, CalendarDays, GanttChart, MessageSquare, CheckSquare, Calendar, Send, Trash2 } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, Badge, PageLoader, EmptyState, cx } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { date, dateTime, titleCase, initials } from '../../lib/format';
import { toDateInput } from '../../lib/obj';

const STATUSES = [['todo', 'To Do'], ['in_progress', 'In Progress'], ['review', 'Review'], ['completed', 'Completed'], ['on_hold', 'On Hold']];
const PRI = { low: 'gray', medium: 'blue', high: 'amber', urgent: 'red' };
const overdue = (t) => t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < new Date();

function TaskDrawer({ task, people, projects, onClose }) {
  const can = useCan();
  const [f, setF] = useState(() => ({ title: '', description: '', status: 'todo', priority: 'medium', checklist: [], assignees: [], ...task,
    project: task?.project?._id || task?.project || '', approver: task?.approver?._id || task?.approver || '', assignees: (task?.assignees || []).map((a) => a._id || a),
    dueDate: toDateInput(task?.dueDate), startDate: toDateInput(task?.startDate), reminderAt: task?.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : '' }));
  const [comment, setComment] = useState('');
  const save = useApiMutation({ method: task?._id ? 'PATCH' : 'POST', path: task?._id ? `/company/work/tasks/${task._id}` : '/company/work/tasks', invalidate: [['res', '/company/work/tasks'], 'tasks'], success: 'Task saved', onSuccess: onClose });
  const del = useApiMutation({ method: 'DELETE', invalidate: ['tasks'], success: 'Task deleted', onSuccess: onClose });
  const addComment = useApiMutation({ path: `/company/work/tasks/${task?._id}/comments`, invalidate: ['tasks'], onSuccess: (r) => { setF((s) => ({ ...s, comments: [...(s.comments || []), r.data] })); setComment(''); } });
  const submit = () => save.mutate({ body: { title: f.title, description: f.description, status: f.status, priority: f.priority, project: f.project || null, approver: f.approver || null, assignees: f.assignees,
    dueDate: f.dueDate || null, startDate: f.startDate || null, reminderAt: f.reminderAt ? new Date(f.reminderAt) : null, checklist: f.checklist } });
  const done = f.checklist.filter((c) => c.done).length;

  return (
    <Modal open onClose={onClose} size="lg" title={task?._id ? 'Task details' : 'New task'}
      footer={<>{task?._id && can('tasks.task.delete') && <Button variant="ghost" icon={Trash2} onClick={() => window.confirm('Delete task?') && del.mutate({ path: `/company/work/tasks/${task._id}` })} className="mr-auto">Delete</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button><Button loading={save.isPending} onClick={submit} disabled={!f.title.trim()}>Save</Button></>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea label="Description" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div><div className="mb-2 flex items-center justify-between"><span className="label mb-0">Checklist {f.checklist.length > 0 && `(${done}/${f.checklist.length})`}</span>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setF({ ...f, checklist: [...f.checklist, { text: '', done: false }] })}>Item</Button></div>
            {f.checklist.map((c, i) => <div key={i} className="mb-1.5 flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-royal-600" checked={c.done} onChange={(e) => setF({ ...f, checklist: f.checklist.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} />
              <input className="input py-1.5" value={c.text} onChange={(e) => setF({ ...f, checklist: f.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
              <button onClick={() => setF({ ...f, checklist: f.checklist.filter((_, j) => j !== i) })} className="text-slate-400" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></div>)}</div>
          {task?._id && <div><span className="label">Comments</span>
            <div className="max-h-56 space-y-2 overflow-y-auto">{(f.comments || []).map((c, i) => <div key={i} className="rounded-xl bg-soft-50 p-3 text-sm dark:bg-white/5"><p className="text-xs text-slate-500"><b>{c.userName}</b> · {dateTime(c.at)}</p><p className="mt-1 whitespace-pre-line">{c.text}</p></div>)}</div>
            <div className="mt-2 flex gap-2"><input className="input" placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && comment.trim() && addComment.mutate({ body: { text: comment } })} />
              <Button icon={Send} disabled={!comment.trim()} onClick={() => addComment.mutate({ body: { text: comment } })} aria-label="Send" /></div></div>}
          {task?.history?.length > 0 && <details className="text-xs text-slate-500"><summary className="cursor-pointer">History</summary>{[...task.history].reverse().map((h, i) => <p key={i}>{dateTime(h.at)} · {h.user}: {h.change}</p>)}</details>}
        </div>
        <div className="space-y-3">
          <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          <Select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select>
          <Select label="Project" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}><option value="">No project</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
          <div><span className="label">Assignees</span><div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">{people.map((u) => { const on = f.assignees.includes(u._id); return <button key={u._id} type="button" onClick={() => setF({ ...f, assignees: on ? f.assignees.filter((x) => x !== u._id) : [...f.assignees, u._id] })} className={cx('rounded-lg px-2 py-1 text-xs', on ? 'bg-royal-600 text-white' : 'bg-soft-100 dark:bg-white/10')}>{u.name}</button>; })}</div></div>
          <Select label="Approver (optional)" value={f.approver} onChange={(e) => setF({ ...f, approver: e.target.value })}><option value="">No approval needed</option>{people.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</Select>
          <Input label="Start date" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          <Input label="Due date" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          <Input label="Reminder" type="datetime-local" value={f.reminderAt} onChange={(e) => setF({ ...f, reminderAt: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function TaskCard({ t, onOpen, draggable, onDragStart }) {
  return (
    <button draggable={draggable} onDragStart={onDragStart} onClick={() => onOpen(t)} className="card block w-full p-3 text-left transition hover:border-royal-500/40 hover:shadow-md">
      <div className="mb-1.5 flex items-center gap-1.5"><Badge color={PRI[t.priority]}>{t.priority}</Badge>{t.project && <span className="truncate text-[11px] text-slate-500">{t.project.name}</span>}</div>
      <p className="text-sm font-semibold text-navy-900 dark:text-white">{t.title}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-2">{t.dueDate && <span className={cx('flex items-center gap-1', overdue(t) && 'font-semibold text-red-600')}><Calendar className="h-3 w-3" />{date(t.dueDate)}</span>}
          {t.checklist?.length > 0 && <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" />{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
          {t.comments?.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.comments.length}</span>}</span>
        <span className="flex -space-x-1.5">{t.assignees?.slice(0, 3).map((a) => <span key={a._id} title={a.name} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-royal-600 text-[9px] font-bold text-white dark:border-navy-900">{initials(a.name)}</span>)}</span>
      </div>
    </button>
  );
}

function CalendarView({ tasks, onOpen }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const days = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = tasks.reduce((m, t) => { if (t.dueDate) { const k = key(new Date(t.dueDate)); (m[k] ||= []).push(t); } return m; }, {});
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between"><Button size="sm" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</Button>
        <b>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b><Button size="sm" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</Button></div>
      <div className="grid grid-cols-7 gap-1 text-xs">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="p-1 text-center font-semibold text-slate-500">{d}</div>)}
        {days.map((d) => <div key={key(d)} className={cx('min-h-24 rounded-lg border border-soft-200 p-1 dark:border-white/10', d.getMonth() !== month.getMonth() && 'opacity-40', key(d) === key(new Date()) && 'ring-2 ring-royal-600')}>
          <p className="mb-1 text-right text-slate-500">{d.getDate()}</p>{(byDay[key(d)] || []).slice(0, 3).map((t) => <button key={t._id} onClick={() => onOpen(t)} className={cx('mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-white', t.status === 'completed' ? 'bg-emerald-500' : overdue(t) ? 'bg-red-500' : 'bg-royal-600')}>{t.title}</button>)}
          {(byDay[key(d)] || []).length > 3 && <p className="text-[10px] text-slate-500">+{byDay[key(d)].length - 3} more</p>}</div>)}</div>
    </Card>
  );
}

function TimelineView({ tasks, onOpen }) {
  const dated = tasks.filter((t) => t.dueDate);
  if (!dated.length) return <EmptyState title="No dated tasks" description="Add start and due dates to see the timeline." />;
  const min = Math.min(...dated.map((t) => new Date(t.startDate || t.createdAt).getTime()));
  const max = Math.max(...dated.map((t) => new Date(t.dueDate).getTime())) + 864e5;
  const pct = (v) => ((v - min) / (max - min)) * 100;
  return (
    <Card className="space-y-2 overflow-x-auto p-4">{dated.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map((t) => {
      const s = new Date(t.startDate || t.createdAt).getTime(); const e = new Date(t.dueDate).getTime() + 864e5;
      return <div key={t._id} className="flex min-w-[640px] items-center gap-3 text-sm"><button onClick={() => onOpen(t)} className="w-48 shrink-0 truncate text-left font-medium hover:text-royal-600">{t.title}</button>
        <div className="relative h-6 flex-1 rounded bg-soft-100 dark:bg-white/5"><div className={cx('absolute h-6 rounded text-[10px] leading-6 text-white', t.status === 'completed' ? 'bg-emerald-500' : overdue(t) ? 'bg-red-500' : 'bg-royal-600')} style={{ left: `${pct(s)}%`, width: `${Math.max(2, pct(e) - pct(s))}%` }}><span className="px-1.5">{date(t.dueDate)}</span></div></div></div>;
    })}</Card>
  );
}

export default function Tasks() {
  const can = useCan();
  const session = useAuth((s) => s.session);
  const [view, setView] = useState('board');
  const [scope, setScope] = useState('all');
  const [project, setProject] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(undefined);
  const [dragId, setDragId] = useState(null);
  const { data, isLoading } = useApiQuery('tasks', '/company/work/tasks', { limit: 500, project, q });
  const { data: people } = useQuery({ queryKey: ['ref', '/company/work/people'], queryFn: () => api('/company/work/people') });
  const { data: projects } = useQuery({ queryKey: ['ref', '/company/work/projects'], queryFn: () => api('/company/work/projects', { query: { limit: 200 } }) });
  const move = useApiMutation({ method: 'PATCH', invalidate: ['tasks'] });
  const me = session.user._id;
  const tasks = (data?.data || []).filter((t) => scope === 'all' || (scope === 'mine' ? t.assignees?.some((a) => a._id === me) : t.createdBy === me));

  return (
    <>
      <PageHeader title="Tasks" description="Plan, assign and track work across your team." actions={can('tasks.task.create') && <Button icon={Plus} onClick={() => setOpen(null)}>New task</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-soft-100 p-1 dark:bg-white/5">{[['board', LayoutGrid, 'Kanban'], ['list', List, 'List'], ['calendar', CalendarDays, 'Calendar'], ['timeline', GanttChart, 'Timeline']].map(([v, Icon, l]) => (
          <button key={v} onClick={() => setView(v)} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', view === v ? 'bg-white shadow-sm dark:bg-navy-800' : 'text-slate-500')}><Icon className="h-4 w-4" />{l}</button>))}</div>
        <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-40"><option value="all">All visible</option><option value="mine">My tasks</option><option value="created">Created by me</option></Select>
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-48"><option value="all">All projects</option>{projects?.data?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
        <input className="input max-w-xs" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <PageLoader /> : view === 'board' ? (
        <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-5">{STATUSES.map(([s, l]) => {
          const col = tasks.filter((t) => t.status === s);
          return <div key={s} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) move.mutate({ path: `/company/work/tasks/${dragId}`, body: { status: s } }); setDragId(null); }}
            className="min-w-56 rounded-2xl bg-soft-100/70 p-3 dark:bg-white/5"><p className="mb-3 flex items-center justify-between text-sm font-bold">{l}<span className="rounded-full bg-white px-2 text-xs dark:bg-navy-800">{col.length}</span></p>
            <div className="space-y-2">{col.map((t) => <TaskCard key={t._id} t={t} onOpen={setOpen} draggable={can('tasks.task.edit')} onDragStart={() => setDragId(t._id)} />)}</div></div>;
        })}</div>
      ) : view === 'list' ? (
        <Card>{!tasks.length ? <EmptyState title="No tasks" /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Task', 'Project', 'Assignees', 'Due', 'Priority', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-soft-200 dark:divide-white/10">{tasks.map((t) => <tr key={t._id} onClick={() => setOpen(t)} className="cursor-pointer hover:bg-soft-50 dark:hover:bg-white/5"><td className="td font-medium">{t.title}</td><td className="td">{t.project?.name || '—'}</td>
            <td className="td">{t.assignees?.map((a) => a.name).join(', ') || '—'}</td><td className={cx('td', overdue(t) && 'font-semibold text-red-600')}>{date(t.dueDate)}</td><td className="td"><Badge color={PRI[t.priority]}>{t.priority}</Badge></td><td className="td">{STATUSES.find((x) => x[0] === t.status)?.[1]}</td></tr>)}</tbody></table></div>}</Card>
      ) : view === 'calendar' ? <CalendarView tasks={tasks} onOpen={setOpen} /> : <TimelineView tasks={tasks} onOpen={setOpen} />}
      {open !== undefined && <TaskDrawer task={open} people={people?.data || []} projects={projects?.data || []} onClose={() => setOpen(undefined)} />}
    </>
  );
}
