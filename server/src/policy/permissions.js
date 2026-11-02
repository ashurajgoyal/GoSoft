/**
 * GO SOFT permission catalog.
 * A permission key is `module.resource.action`. Roles grant keys together with a scope.
 * The catalog covers every module in the product roadmap so roles created today keep
 * working as later phases ship. `module` maps to plan modules for subscription gating.
 */

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'download', 'manage', 'configure'];
export const SCOPES = ['own', 'assigned', 'team', 'department', 'company', 'platform'];
export const SCOPE_RANK = Object.fromEntries(SCOPES.map((s, i) => [s, i]));

/** Plan modules that can be switched on/off per subscription plan. */
export const MODULES = {
  core: { label: 'Core workspace', alwaysOn: true },
  billing: { label: 'Billing & GST' },
  hrms: { label: 'HRMS (employees, attendance, leave)' },
  payroll: { label: 'Payroll' },
  tasks: { label: 'Tasks & Projects' },
  reports: { label: 'Reports' },
  analytics: { label: 'Advanced analytics' },
  customRoles: { label: 'Custom roles & permissions' },
  multiBranch: { label: 'Multiple branches' },
  integrations: { label: 'Integrations & API' },
};

const r = (module, resource, label, actions) => ({ module, resource, label, actions });

export const RESOURCES = [
  r('core', 'company', 'Company settings', ['view', 'edit', 'configure']),
  r('core', 'user', 'Users', ['view', 'create', 'edit', 'delete', 'manage']),
  r('core', 'role', 'Roles & permissions', ['view', 'create', 'edit', 'delete']),
  r('core', 'department', 'Departments', ['view', 'create', 'edit', 'delete']),
  r('core', 'announcement', 'Announcements', ['view', 'create', 'edit', 'delete']),
  r('core', 'subscription', 'Subscription & billing', ['view', 'manage']),
  r('core', 'audit', 'Audit logs', ['view', 'export']),

  r('billing', 'invoice', 'Invoices', ['view', 'create', 'edit', 'delete', 'approve', 'export', 'download']),
  r('billing', 'customer', 'Customers', ['view', 'create', 'edit', 'delete', 'export']),
  r('billing', 'product', 'Products & services', ['view', 'create', 'edit', 'delete']),
  r('billing', 'vendor', 'Vendors', ['view', 'create', 'edit', 'delete']),
  r('billing', 'expense', 'Expenses', ['view', 'create', 'edit', 'delete', 'approve', 'export']),
  r('billing', 'settings', 'Billing settings', ['view', 'configure']),

  r('hrms', 'employee', 'Employees', ['view', 'create', 'edit', 'delete', 'export']),
  r('hrms', 'document', 'Employee documents', ['view', 'create', 'delete', 'download']),
  r('hrms', 'attendance', 'Attendance', ['view', 'create', 'edit', 'approve', 'export']),
  r('hrms', 'leave', 'Leave', ['view', 'create', 'edit', 'approve']),
  r('hrms', 'settings', 'HR settings', ['view', 'configure']),

  r('payroll', 'payroll', 'Payroll runs', ['view', 'create', 'edit', 'approve', 'export']),
  r('payroll', 'payslip', 'Payslips', ['view', 'download']),

  r('tasks', 'project', 'Projects', ['view', 'create', 'edit', 'delete', 'manage']),
  r('tasks', 'task', 'Tasks', ['view', 'create', 'edit', 'delete', 'approve']),

  r('reports', 'report', 'Reports', ['view', 'export']),
  r('analytics', 'dashboard', 'Analytics dashboards', ['view']),
];

export const ALL_PERMISSION_KEYS = RESOURCES.flatMap((res) => res.actions.map((a) => `${res.module}.${res.resource}.${a}`));
const KEY_SET = new Set(ALL_PERMISSION_KEYS);
export const isValidPermissionKey = (key) => key === '*' || KEY_SET.has(key);
export const moduleOfKey = (key) => key.split('.')[0];

/** Helper for templates: grant(scope, ...keys) */
const grant = (scope, ...keys) => keys.map((key) => ({ key, scope }));
const allOf = (prefix, scope = 'company') =>
  ALL_PERMISSION_KEYS.filter((k) => k.startsWith(prefix)).map((key) => ({ key, scope }));

/** Default roles created for every new company. `locked` roles cannot be edited or deleted. */
export const DEFAULT_ROLE_TEMPLATES = [
  {
    slug: 'company-owner', name: 'Company Owner', locked: true,
    description: 'Full control of the company workspace, including subscription.',
    permissions: [{ key: '*', scope: 'company' }],
  },
  {
    slug: 'company-admin', name: 'Company Admin', locked: false,
    description: 'Manages users, roles, settings and company reports.',
    permissions: ALL_PERMISSION_KEYS
      .filter((k) => !k.startsWith('core.subscription.manage'))
      .map((key) => ({ key, scope: 'company' })),
  },
  {
    slug: 'hr-manager', name: 'HR Manager', locked: false,
    description: 'Employees, attendance, leave, documents and payroll preparation.',
    permissions: [
      ...grant('company', 'core.user.view', 'core.department.view', 'core.announcement.view', 'core.announcement.create'),
      ...allOf('hrms.'),
      ...grant('company', 'payroll.payroll.view', 'payroll.payroll.create', 'payroll.payroll.edit', 'payroll.payslip.view', 'payroll.payslip.download'),
      ...grant('company', 'reports.report.view'),
    ],
  },
  {
    slug: 'accountant', name: 'Accountant', locked: false,
    description: 'Invoices, customers, expenses and financial reports.',
    permissions: [
      ...grant('company', 'core.announcement.view'),
      ...allOf('billing.'),
      ...grant('company', 'reports.report.view', 'reports.report.export'),
    ],
  },
  {
    slug: 'team-manager', name: 'Team Manager', locked: false,
    description: 'Manages assigned projects, assigns and approves tasks.',
    permissions: [
      ...grant('company', 'core.announcement.view'),
      ...grant('team', 'core.user.view', 'hrms.employee.view', 'hrms.attendance.view', 'hrms.leave.view', 'hrms.leave.approve'),
      ...grant('assigned', 'tasks.project.view', 'tasks.project.edit', 'tasks.project.manage'),
      ...grant('team', 'tasks.task.view', 'tasks.task.create', 'tasks.task.edit', 'tasks.task.approve'),
      ...grant('team', 'reports.report.view'),
    ],
  },
  {
    slug: 'employee', name: 'Employee', locked: false,
    description: 'Self-service: own attendance, leave, payslips and assigned tasks.',
    permissions: [
      ...grant('company', 'core.announcement.view'),
      ...grant('own', 'hrms.attendance.view', 'hrms.attendance.create', 'hrms.leave.view', 'hrms.leave.create',
        'hrms.document.view', 'hrms.document.create', 'payroll.payslip.view', 'payroll.payslip.download'),
      ...grant('assigned', 'tasks.task.view', 'tasks.task.edit', 'tasks.project.view'),
    ],
  },
];
