import { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import ResourcePage from '../../components/ResourcePage';
import { Badge, Card, PageHeader, Button, Input, PageLoader, cx } from '../../components/ui';
import { useApiMutation, useApiQuery } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { date, titleCase, inr } from '../../lib/format';

export function Employees() {
  const can = useCan();
  const createLogin = useApiMutation({ method: 'POST', invalidate: [['res', '/company/hr/employees']], success: 'Login invitation sent' });
  const sensitive = can('payroll.payroll.view');
  return <ResourcePage title="Employees" singular="employee" endpoint="/company/hr/employees" perm="hrms.employee" csv
    filters={[{ name: 'status', label: 'Status', options: [['active', 'Active'], ['on_notice', 'On notice'], ['exited', 'Exited']] }, { name: 'employmentType', label: 'Type', options: [['full_time', 'Full time'], ['part_time', 'Part time'], ['contract', 'Contract'], ['intern', 'Intern']] }]}
    defaults={{ employmentType: 'full_time', status: 'active', joiningDate: new Date().toISOString().slice(0, 10), salary: { pfApplicable: true, esiApplicable: true, ptApplicable: true } }}
    columns={[{ key: 'employeeId', label: 'ID' }, { label: 'Name', render: (e) => <><p className="font-medium">{e.name}</p><p className="text-xs text-slate-500">{e.email}</p></> },
      { label: 'Department', render: (e) => e.department?.name || '—' }, { key: 'designation', label: 'Designation' }, { label: 'Joined', render: (e) => date(e.joiningDate) },
      ...(sensitive ? [{ label: 'Monthly fixed', render: (e) => inr((e.salary?.basic || 0) + (e.salary?.hra || 0) + (e.salary?.allowances || []).reduce((s, a) => s + (a.amount || 0), 0)) }] : []),
      { label: 'Login', render: (e) => (e.user ? <Badge color="green">{e.user.status}</Badge> : <Badge>None</Badge>) }, { label: 'Status', render: (e) => <Badge color={e.status === 'active' ? 'green' : e.status === 'exited' ? 'gray' : 'amber'}>{titleCase(e.status)}</Badge> }]}
    rowActions={(e) => !e.user && e.email && can('core.user.create') && <button title="Create login & invite" onClick={() => createLogin.mutate({ path: `/company/hr/employees/${e._id}/create-login` })} className="rounded-lg p-1.5 text-slate-500 hover:bg-soft-100 dark:hover:bg-white/10"><KeyRound className="h-4 w-4" /></button>}
    fields={[{ section: 'Personal' }, { name: 'firstName', label: 'First name', required: true }, { name: 'lastName', label: 'Last name' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' },
      { name: 'gender', label: 'Gender', type: 'select', options: [['male', 'Male'], ['female', 'Female'], ['other', 'Other']] }, { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      { section: 'Employment' }, { name: 'employeeId', label: 'Employee ID', placeholder: 'Auto-generated if empty' }, { name: 'department', label: 'Department', type: 'ref', endpoint: '/company/hr/departments' },
      { name: 'designation', label: 'Designation' }, { name: 'reportingManager', label: 'Reporting manager', type: 'ref', endpoint: '/company/hr/employees' },
      { name: 'employmentType', label: 'Employment type', type: 'select', options: [['full_time', 'Full time'], ['part_time', 'Part time'], ['contract', 'Contract'], ['intern', 'Intern']] },
      { name: 'joiningDate', label: 'Joining date', type: 'date', required: true }, { name: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['on_notice', 'On notice'], ['exited', 'Exited']] }, { name: 'exitDate', label: 'Exit date', type: 'date' },
      ...(sensitive ? [{ section: 'Salary (monthly)' }, { name: 'salary.basic', label: 'Basic (₹)', type: 'number' }, { name: 'salary.hra', label: 'HRA (₹)', type: 'number' }, { name: 'salary.tdsMonthly', label: 'TDS per month (₹)', type: 'number' },
        { name: 'salary.pfApplicable', label: 'PF applicable', type: 'checkbox' }, { name: 'salary.esiApplicable', label: 'ESI applicable', type: 'checkbox' }, { name: 'salary.ptApplicable', label: 'Professional tax applicable', type: 'checkbox' },
        { section: 'Bank & statutory' }, { name: 'bank.accountName', label: 'Account holder name' }, { name: 'bank.accountNumber', label: 'Account number' }, { name: 'bank.ifsc', label: 'IFSC', upper: true }, { name: 'bank.bankName', label: 'Bank name' },
        { name: 'pan', label: 'PAN', upper: true, maxLength: 10 }, { name: 'uan', label: 'UAN (PF)' }, { name: 'esicNumber', label: 'ESIC number' }] : []),
      { section: 'Emergency contact' }, { name: 'emergencyContact.name', label: 'Name' }, { name: 'emergencyContact.relation', label: 'Relation' }, { name: 'emergencyContact.phone', label: 'Phone' },
      { name: 'address.line1', label: 'Address', full: true }, { name: 'address.city', label: 'City' }]}
    transformIn={(b, v) => (sensitive ? { ...b, salary: { ...v.salary, ...b.salary, allowances: v.salary?.allowances || [] } } : b)} />;
}

export const Departments = () => <ResourcePage title="Departments" singular="department" endpoint="/company/hr/departments" perm="core.department"
  columns={[{ key: 'name', label: 'Name' }, { label: 'Head', render: (d) => (d.head ? `${d.head.firstName} ${d.head.lastName || ''}` : '—') }, { key: 'description', label: 'Description' }]}
  fields={[{ name: 'name', label: 'Department name', required: true }, { name: 'head', label: 'Department head', type: 'ref', endpoint: '/company/hr/employees' }, { name: 'description', label: 'Description', type: 'textarea' }]} />;

export const Holidays = () => <ResourcePage title="Holiday calendar" singular="holiday" endpoint="/company/hr/holidays" perm="hrms.settings"
  columns={[{ label: 'Date', render: (h) => date(h.date) }, { label: 'Day', render: (h) => new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long' }) }, { key: 'name', label: 'Holiday' }, { label: 'Type', render: (h) => <Badge color={h.optional ? 'amber' : 'blue'}>{h.optional ? 'Optional' : 'Mandatory'}</Badge> }]}
  fields={[{ name: 'name', label: 'Holiday name', required: true }, { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'optional', label: 'Optional holiday', type: 'checkbox' }]} />;

export const LeaveTypes = () => <ResourcePage title="Leave types & policies" singular="leave type" endpoint="/company/hr/leave-types" perm="hrms.settings" defaults={{ annualQuota: 12, paid: true, active: true, color: '#1E4FD8' }}
  columns={[{ label: 'Name', render: (t) => <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: t.color }} />{t.name} <span className="text-xs text-slate-500">{t.code}</span></span> },
    { key: 'annualQuota', label: 'Days / year' }, { label: 'Paid', render: (t) => (t.paid ? 'Paid' : 'Unpaid (LOP)') }, { label: 'Carry forward', render: (t) => (t.carryForward ? 'Yes' : 'No') }, { label: 'Status', render: (t) => <Badge color={t.active ? 'green' : 'gray'}>{t.active ? 'Active' : 'Inactive'}</Badge> }]}
  fields={[{ name: 'name', label: 'Name', required: true }, { name: 'code', label: 'Code' }, { name: 'annualQuota', label: 'Days per year', type: 'number', required: true }, { name: 'color', label: 'Colour', type: 'color' },
    { name: 'paid', label: 'Paid leave', type: 'checkbox' }, { name: 'carryForward', label: 'Carry forward unused days', type: 'checkbox' }, { name: 'active', label: 'Active', type: 'checkbox' }]} />;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function HrSettings() {
  const can = useCan();
  const { data, isLoading } = useApiQuery('hr-settings', '/company/hr/settings');
  const [f, setF] = useState(null);
  const save = useApiMutation({ method: 'PATCH', path: '/company/hr/settings', invalidate: ['hr-settings'], success: 'HR settings saved' });
  useEffect(() => { if (data) setF({ weeklyOffs: [0], ...data.data }); }, [data]);
  if (isLoading || !f) return <PageLoader />;
  const b = (k, n) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: n ? Number(e.target.value) : e.target.value }) });
  return (
    <>
      <PageHeader title="HR & attendance settings" actions={can('hrms.settings.configure') && <Button icon={Save} loading={save.isPending} onClick={() => save.mutate({ body: f })}>Save</Button>} />
      <Card className="grid max-w-3xl gap-4 p-6 sm:grid-cols-2">
        <Input label="Shift start" type="time" {...b('shiftStart')} /><Input label="Shift end" type="time" {...b('shiftEnd')} />
        <Input label="Late grace (minutes)" type="number" {...b('graceMinutes', 1)} /><Input label="Employee ID prefix" {...b('employeeIdPrefix')} />
        <Input label="Full day = hours" type="number" {...b('fullDayHours', 1)} /><Input label="Half day = hours" type="number" {...b('halfDayHours', 1)} />
        <div className="sm:col-span-2"><span className="label">Weekly offs</span><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => (
          <button key={d} type="button" onClick={() => setF({ ...f, weeklyOffs: f.weeklyOffs.includes(i) ? f.weeklyOffs.filter((x) => x !== i) : [...f.weeklyOffs, i] })}
            className={cx('rounded-lg px-3 py-1.5 text-sm font-medium', f.weeklyOffs.includes(i) ? 'bg-royal-600 text-white' : 'bg-soft-100 dark:bg-white/10')}>{d}</button>))}</div></div>
      </Card>
    </>
  );
}
