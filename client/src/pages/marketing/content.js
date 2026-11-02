import { Receipt, FileSpreadsheet, UserSquare2, Wallet, Users, Clock, KanbanSquare, LayoutGrid } from 'lucide-react';

/** SEO landing pages. Phase 5 moves this content into the Super Admin website CMS. */
export const MODULE_PAGES = [
  {
    slug: 'billing-software-india', name: 'Billing Software', short: 'Invoices, quotes, receipts & ledgers', icon: Receipt,
    title: 'Billing Software for Indian Businesses',
    h1: 'Billing software that keeps your cash flow moving',
    intro: 'Create professional invoices in seconds, track every rupee owed to you and keep customer ledgers up to date automatically — without spreadsheets.',
    points: ['Branded invoice PDFs with auto-numbering by financial year', 'Proforma invoices, credit notes, debit notes and payment receipts', 'Customer & vendor management with running ledgers', 'Outstanding payment tracking and reminders', 'Product and service catalogue with HSN/SAC codes', 'Sales and revenue reports with Excel, CSV and PDF export'],
  },
  {
    slug: 'gst-billing-software', name: 'GST Billing', short: 'CGST, SGST, IGST done right', icon: FileSpreadsheet,
    title: 'GST Billing Software',
    h1: 'GST billing without the guesswork',
    intro: 'GO SOFT works out CGST + SGST or IGST from the place of supply, applies the right rate for each HSN/SAC code and prepares tax summaries for filing.',
    points: ['Automatic intra-state vs inter-state tax split', 'Tax-inclusive and tax-exclusive pricing', 'GSTIN validation for your customers', 'HSN/SAC-wise tax summaries', 'Configurable tax rates as rules change', 'Financial year settings (April–March by default)'],
  },
  {
    slug: 'hrms-software-india', name: 'HRMS Software', short: 'Your complete people platform', icon: UserSquare2,
    title: 'HRMS Software India',
    h1: 'An HRMS your whole team will actually use',
    intro: 'From joining day to full and final settlement, keep every employee record, document and request in one secure place.',
    points: ['Employee profiles, IDs, departments and designations', 'Reporting managers and employment types', 'Secure document storage', 'Leave policies, balances and holiday calendars', 'Employee self-service portal', 'HR reports by department, attendance and leave'],
  },
  {
    slug: 'payroll-software-india', name: 'Payroll Software', short: 'Accurate salaries, every month', icon: Wallet,
    title: 'Payroll Software India',
    h1: 'Run payroll in minutes, not days',
    intro: 'Build salary structures once and let GO SOFT handle allowances, deductions, overtime and statutory calculations every month.',
    points: ['Salary structures with Basic, HRA and allowances', 'Bonuses, incentives, overtime and salary advances', 'Configurable PF, ESI, TDS and Professional Tax', 'Payroll approval workflow', 'One-click payslip generation', 'Complete payroll history and salary reports'],
  },
  {
    slug: 'employee-management-software', name: 'Employee Management', short: 'Profiles, roles & lifecycle', icon: Users,
    title: 'Employee Management Software',
    h1: 'Every employee, every detail, one place',
    intro: 'Give managers the visibility they need and employees the self-service they expect — with permissions that keep sensitive data private.',
    points: ['Granular role-based permissions', 'Team, department and company-level visibility', 'Employee lifecycle tracking', 'Company announcements', 'Emergency contacts and bank details stored encrypted', 'Audit trail of every change'],
  },
  {
    slug: 'attendance-software', name: 'Attendance Software', short: 'Check-in, overtime & corrections', icon: Clock,
    title: 'Employee Attendance Software',
    h1: 'Attendance tracking that runs itself',
    intro: 'Employees check in and out from any device. GO SOFT works out working hours, late arrivals, early departures and overtime automatically.',
    points: ['Web and mobile check-in / check-out', 'Break tracking and working hours', 'Late arrival and early departure flags', 'Overtime calculation feeding payroll', 'Attendance correction requests with approval', 'Daily, monthly and department reports'],
  },
  {
    slug: 'task-management-software', name: 'Task Management', short: 'Projects, Kanban & timelines', icon: KanbanSquare,
    title: 'Task & Project Management Software',
    h1: 'Plan, assign and deliver — on time',
    intro: 'Projects, tasks, checklists and approvals with Kanban, list, calendar and timeline views, so everyone knows what to do next.',
    points: ['Projects with managers, members and deadlines', 'Tasks with priorities, checklists and attachments', 'Kanban, list, calendar and timeline views', 'Comments, reminders and task history', 'Review and approval workflow', 'Team productivity reports'],
  },
  {
    slug: 'business-management-software', name: 'Business Management', short: 'Everything, one platform', icon: LayoutGrid,
    title: 'Business Management Software',
    h1: 'One platform. Complete business control.',
    intro: 'Stop juggling separate apps for billing, HR, payroll and projects. GO SOFT connects them so your data flows and your team stays in sync.',
    points: ['Billing, HRMS, payroll and tasks in one login', 'Real-time business dashboards', 'Role-based access for every team member', 'Strict data isolation per company', 'Flexible monthly and annual plans', 'Built for India, ready to scale globally'],
  },
];

export const FAQS = [
  ['Is GO SOFT suitable for small businesses?', 'Yes. The Starter plan is designed for small teams, and you can upgrade at any time as you grow — your data stays exactly where it is.'],
  ['Does GO SOFT support GST billing?', 'Yes. GO SOFT is built for Indian GST: CGST, SGST and IGST, HSN/SAC codes, place of supply and tax summaries. Tax rules are configurable so they can be updated as regulations change.'],
  ['Is there a free trial?', 'Yes. Every new workspace starts with a free trial — no credit card required. You can choose a plan whenever you are ready.'],
  ['Is my data secure?', 'Every company gets an isolated workspace. Access is controlled by role-based permissions enforced on our servers, sensitive fields are encrypted, and every important action is recorded in an audit log.'],
  ['What happens if my subscription expires?', 'Your data is never deleted because a subscription expired. You get a grace period with read-only access and data export, and you can renew at any time to restore full access.'],
  ['Can I control what each employee can see?', 'Yes. GO SOFT includes ready-made roles (Owner, Admin, HR Manager, Accountant, Team Manager, Employee) and, on supported plans, fully custom roles with granular permissions.'],
];
