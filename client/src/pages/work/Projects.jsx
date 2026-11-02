import ResourcePage from '../../components/ResourcePage';
import { Badge, Progress } from '../../components/ui';
import { date, titleCase } from '../../lib/format';

const PRI = { low: 'gray', medium: 'blue', high: 'amber', urgent: 'red' };
export default function Projects() {
  return <ResourcePage title="Projects" singular="project" endpoint="/company/work/projects" perm="tasks.project"
    filters={[{ name: 'status', label: 'Status', options: ['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => [s, titleCase(s)]) }]} defaults={{ status: 'active', priority: 'medium' }}
    columns={[{ label: 'Project', render: (p) => <><p className="font-medium">{p.name}</p><p className="text-xs text-slate-500">{p.code} {p.client?.name && `· ${p.client.name}`}</p></> },
      { label: 'Manager', render: (p) => p.manager?.name || '—' }, { label: 'Team', render: (p) => `${p.members?.length || 0} members` }, { label: 'Deadline', render: (p) => date(p.deadline) },
      { label: 'Priority', render: (p) => <Badge color={PRI[p.priority]}>{p.priority}</Badge> }, { label: 'Progress', render: (p) => <div className="w-28"><Progress value={p.progress} max={100} /><span className="text-xs text-slate-500">{p.progress}%</span></div> },
      { label: 'Status', render: (p) => <Badge color={p.status === 'completed' ? 'green' : p.status === 'active' ? 'blue' : 'gray'}>{titleCase(p.status)}</Badge> }]}
    fields={[{ name: 'name', label: 'Project name', required: true }, { name: 'code', label: 'Code' }, { name: 'manager', label: 'Project manager', type: 'ref', endpoint: '/company/work/people' },
      { name: 'client', label: 'Client', type: 'ref', endpoint: '/company/billing/customers', placeholder: 'Internal project' }, { name: 'startDate', label: 'Start date', type: 'date' }, { name: 'deadline', label: 'Deadline', type: 'date' },
      { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] }, { name: 'status', label: 'Status', type: 'select', options: ['planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => [s, titleCase(s)]) },
      { name: 'members', label: 'Team members', type: 'ref', multiple: true, endpoint: '/company/work/people' }, { name: 'description', label: 'Description', type: 'textarea' }]} />;
}
