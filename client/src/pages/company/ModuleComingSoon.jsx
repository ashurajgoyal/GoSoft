import { Link, useParams, Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Card, Button } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { hasModule, can } from '../../lib/permissions';

const INFO = {
  billing: ['Billing & GST', 'GST invoices, credit/debit notes, customers, products, vendors, expenses, ledgers and GST reports.', '/app/billing/invoices'],
  hrms: ['HRMS', 'Employee profiles, attendance with check-in/out, leave policies, holiday calendars and employee requests.', '/app/hr/employees'],
  payroll: ['Payroll', 'Salary structures, PF/ESI/PT/TDS, payroll approval and payslip generation.', '/app/payroll'],
  tasks: ['Tasks & Projects', 'Projects, Kanban, calendar and timeline views, checklists, comments and approvals.', '/app/tasks'],
  analytics: ['Analytics', 'Business dashboards across revenue, people, attendance and delivery.', '/app/analytics'],
};

/** Upgrade screen for modules that are not part of the current plan. */
export default function ModuleLocked() {
  const { module } = useParams();
  const session = useAuth((s) => s.session);
  const [name, desc, home] = INFO[module] || ['Module', '', '/app'];
  if (hasModule(session, module)) return <Navigate to={home} replace />;
  return (
    <Card className="mx-auto max-w-2xl p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600"><Lock className="h-8 w-8" /></div>
      <h1 className="mt-6 text-2xl font-extrabold text-navy-900 dark:text-white">{name}</h1>
      <p className="mt-3 text-slate-500">{desc}</p>
      <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{name} is not included in your current plan.</p>
      {can(session, 'core.subscription.view') && <Link to="/app/subscription"><Button className="mt-6">Upgrade plan</Button></Link>}
    </Card>
  );
}
