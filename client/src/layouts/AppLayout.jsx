import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Building2, Layers, ShieldCheck, ScrollText, Inbox, Users, KeyRound, Settings, CreditCard,
  Receipt, UserSquare2, Wallet, KanbanSquare, BarChart3, LogOut, Menu, X, ChevronDown, UserCircle2, AlertTriangle, Lock, Wrench,
  Home, Megaphone, PieChart, Package, Truck, ReceiptIndianRupee, Clock, CalendarOff, MessageSquareText, Network, CalendarDays, FolderKanban,
  Landmark, BadgePercent, Newspaper, Globe, Settings2,
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import { Logo } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { Badge, Button, cx } from '../components/ui';
import { useAuth } from '../store/auth';
import { post } from '../lib/api';
import { can, hasModule } from '../lib/permissions';
import { initials, date } from '../lib/format';

const ADMIN_NAV = [
  { section: 'Platform' },
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/plans', label: 'Subscription Plans', icon: Layers },
  { to: '/admin/policies', label: 'Platform Policies', icon: ShieldCheck },
  { section: 'Revenue' },
  { to: '/admin/payments', label: 'Payments', icon: ReceiptIndianRupee },
  { to: '/admin/gateway', label: 'Payment Gateway', icon: Landmark },
  { to: '/admin/coupons', label: 'Coupons', icon: BadgePercent },
  { section: 'Website' },
  { to: '/admin/website', label: 'Website CMS', icon: Globe },
  { to: '/admin/blog', label: 'Blog', icon: Newspaper },
  { to: '/admin/leads', label: 'Leads & Demos', icon: Inbox },
  { section: 'Security' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

const COMPANY_NAV = [
  { section: 'Workspace' },
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/me', label: 'My Workspace', icon: Home },
  { to: '/app/announcements', label: 'Announcements', icon: Megaphone, perm: 'core.announcement.create' },
  { to: '/app/analytics', label: 'Analytics', icon: PieChart, module: 'analytics', perm: 'analytics.dashboard.view' },
  { section: 'Billing & GST', module: 'billing', locked: { to: '/app/m/billing', label: 'Billing & GST', icon: Receipt } },
  { to: '/app/billing/invoices', label: 'Invoices', icon: Receipt, module: 'billing', perm: 'billing.invoice.view' },
  { to: '/app/billing/customers', label: 'Customers', icon: Users, module: 'billing', perm: 'billing.customer.view' },
  { to: '/app/billing/products', label: 'Products & Services', icon: Package, module: 'billing', perm: 'billing.product.view' },
  { to: '/app/billing/vendors', label: 'Vendors', icon: Truck, module: 'billing', perm: 'billing.vendor.view' },
  { to: '/app/billing/expenses', label: 'Expenses', icon: Wallet, module: 'billing', perm: 'billing.expense.view' },
  { to: '/app/billing/reports', label: 'Sales & GST Reports', icon: BarChart3, module: 'billing', perm: 'billing.invoice.view' },
  { to: '/app/billing/settings', label: 'Billing Settings', icon: Settings2, module: 'billing', perm: 'billing.settings.view' },
  { section: 'People', module: 'hrms', locked: { to: '/app/m/hrms', label: 'HRMS', icon: UserSquare2 } },
  { to: '/app/hr/employees', label: 'Employees', icon: UserSquare2, module: 'hrms', perm: 'hrms.employee.view' },
  { to: '/app/hr/attendance', label: 'Attendance', icon: Clock, module: 'hrms', perm: 'hrms.attendance.view' },
  { to: '/app/hr/leaves', label: 'Leave', icon: CalendarOff, module: 'hrms', perm: 'hrms.leave.view' },
  { to: '/app/hr/requests', label: 'Requests', icon: MessageSquareText, module: 'hrms', perm: 'hrms.document.view' },
  { to: '/app/hr/departments', label: 'Departments', icon: Network, module: 'hrms', perm: 'core.department.create' },
  { to: '/app/hr/holidays', label: 'Holidays', icon: CalendarDays, module: 'hrms', perm: 'hrms.settings.view' },
  { to: '/app/hr/leave-types', label: 'Leave Policies', icon: CalendarOff, module: 'hrms', perm: 'hrms.settings.view' },
  { to: '/app/hr/settings', label: 'HR Settings', icon: Settings2, module: 'hrms', perm: 'hrms.settings.view' },
  { section: 'Payroll', module: 'payroll', locked: { to: '/app/m/payroll', label: 'Payroll', icon: Wallet } },
  { to: '/app/payroll', label: 'Payroll Runs', icon: Wallet, module: 'payroll', perm: 'payroll.payroll.create', end: true },
  { to: '/app/payroll/settings', label: 'Statutory Settings', icon: Settings2, module: 'payroll', perm: 'payroll.payroll.approve' },
  { section: 'Work', module: 'tasks', locked: { to: '/app/m/tasks', label: 'Tasks & Projects', icon: KanbanSquare } },
  { to: '/app/tasks', label: 'Tasks', icon: KanbanSquare, module: 'tasks', perm: 'tasks.task.view' },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban, module: 'tasks', perm: 'tasks.project.view' },
  { section: 'Administration' },
  { to: '/app/users', label: 'Users', icon: Users, perm: 'core.user.view' },
  { to: '/app/roles', label: 'Roles & Permissions', icon: KeyRound, perm: 'core.role.view' },
  { to: '/app/settings', label: 'Company Settings', icon: Settings, perm: 'core.company.view' },
  { to: '/app/subscription', label: 'Subscription', icon: CreditCard, perm: 'core.subscription.view' },
  { to: '/app/audit-logs', label: 'Audit Logs', icon: ScrollText, perm: 'core.audit.view' },
];

function Sidebar({ panel, session, onNavigate }) {
  const items = (panel === 'super_admin' ? ADMIN_NAV : COMPANY_NAV).flatMap((i) => {
    // Modules not in the plan collapse into a single locked "upgrade" entry.
    if (i.section && i.module && !hasModule(session, i.module)) return i.locked ? [{ ...i.locked, module: i.module }] : [];
    if (!i.section && i.module && !hasModule(session, i.module) && !i.icon) return [];
    if (!i.section && i.module && !hasModule(session, i.module) && i.to !== `/app/m/${i.module}`) return [];
    return [i];
  });
  const visible = items.filter((i) => i.section || !i.perm || can(session, i.perm) || (i.anyPerm || []).some((k) => can(session, k)));
  // Drop section headings with no visible items after them.
  const cleaned = visible.filter((i, idx) => !i.section || (visible[idx + 1] && !visible[idx + 1].section));

  return (
    <div className="flex h-full flex-col bg-navy-950 text-slate-300">
      <div className="flex h-16 items-center px-5"><Logo light to={panel === 'super_admin' ? '/admin' : '/app'} size={32} /></div>
      {panel === 'super_admin' && <div className="mx-4 mb-2 rounded-lg bg-electric-500/10 px-3 py-1.5 text-xs font-semibold text-electric-300">SUPER ADMIN</div>}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {cleaned.map((item, i) => item.section ? (
          <p key={`s${i}`} className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.section}</p>
        ) : (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}
            className={({ isActive }) => cx('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-gradient-to-r from-royal-600 to-royal-500 text-white shadow-lg shadow-royal-600/30' : 'hover:bg-white/5 hover:text-white')}>
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.module && !hasModule(session, item.module) && <Lock className="h-3.5 w-3.5 text-slate-500" />}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-[11px] text-slate-500">Powered by <span className="font-semibold text-slate-300">Goyals Group</span></div>
    </div>
  );
}

function UserMenu({ session, panel }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const logout = async () => {
    await post('/auth/logout').catch(() => {});
    useAuth.getState().clear();
    qc.clear();
    navigate('/login');
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-xl p-1.5 pr-2 hover:bg-soft-100 dark:hover:bg-white/5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600 to-electric-500 text-sm font-bold text-white">{initials(session.user.name)}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold text-navy-900 dark:text-white">{session.user.name}</span>
          <span className="block text-xs text-slate-500">{panel === 'super_admin' ? 'Super Admin' : session.role?.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="card absolute right-0 z-40 mt-2 w-56 p-1.5 shadow-xl">
            <div className="border-b border-soft-200 px-3 py-2 dark:border-white/10">
              <p className="truncate text-sm font-semibold">{session.user.name}</p>
              <p className="truncate text-xs text-slate-500">{session.user.email}</p>
            </div>
            <Link to={panel === 'super_admin' ? '/admin/profile' : '/app/profile'} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-soft-100 dark:hover:bg-white/5"><UserCircle2 className="h-4 w-4" />My profile</Link>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Full-page screens for suspended / blocked / pending / subscription-required workspaces. */
function BlockingScreen({ session }) {
  const { company, subscription, support } = session;
  let title; let body; let tone = 'red'; let cta = null;
  if (company?.status === 'pending') {
    tone = 'amber'; title = 'Your workspace is awaiting approval';
    body = 'Thanks for registering! Our team is reviewing your company details. You will receive an email as soon as your workspace is activated.';
  } else if (company?.status === 'suspended' || company?.status === 'blocked') {
    title = `This workspace has been ${company.status}`;
    body = company.suspension?.reason ? `Reason: ${company.suspension.reason}` : 'Please contact GO SOFT support for more information.';
  } else {
    tone = 'amber'; title = 'Your subscription has ended';
    body = subscription?.warning || 'Renew your plan to continue using GO SOFT. Your data is safe and has not been deleted.';
    cta = can(session, 'core.subscription.view') && <Link to="/app/subscription"><Button>View plans & renew</Button></Link>;
  }
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className={cx('mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl', tone === 'red' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/15 text-amber-600')}>
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-navy-900 dark:text-white">{title}</h1>
      <p className="mt-3 text-slate-500">{body}</p>
      <div className="mt-6 flex justify-center gap-2">{cta}</div>
      <p className="mt-8 text-sm text-slate-500">Need help? Email <a className="font-semibold text-royal-600" href={`mailto:${support?.email}`}>{support?.email}</a>{support?.phone && <> or call {support.phone}</>}</p>
    </div>
  );
}

function Banners({ session }) {
  const items = [];
  if (session.maintenance) items.push({ icon: Wrench, tone: 'blue', text: session.maintenance.message });
  const s = session.subscription;
  if (s?.warning && ['trialing', 'active', 'grace', 'read_only'].includes(s.state)) {
    items.push({ icon: AlertTriangle, tone: s.state === 'grace' || s.state === 'read_only' ? 'red' : 'amber', text: s.warning, link: can(session, 'core.subscription.view') ? '/app/subscription' : null });
  }
  if (!items.length) return null;
  const tones = { amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20', red: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/20', blue: 'bg-royal-600/5 text-royal-700 border-royal-600/20 dark:text-electric-300' };
  return items.map((b, i) => (
    <div key={i} className={cx('mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm', tones[b.tone])}>
      <b.icon className="h-4 w-4 shrink-0" /><span className="flex-1">{b.text}</span>
      {b.link && <Link to={b.link} className="font-semibold underline">Manage plan</Link>}
    </div>
  ));
}

export default function AppLayout({ panel }) {
  const session = useAuth((s) => s.session);
  const [mobile, setMobile] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMobile(false), [pathname]);

  const blocked = panel === 'company' && (
    ['pending', 'suspended', 'blocked'].includes(session.company?.status)
    || (['none', 'blocked'].includes(session.subscription?.state) && !pathname.startsWith('/app/subscription') && pathname !== '/app/profile')
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:!hidden"><Sidebar panel={panel} session={session} /></aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-72"><Sidebar panel={panel} session={session} onNavigate={() => setMobile(false)} /></div>
          <button className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white" onClick={() => setMobile(false)}><X /></button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64 print:!pl-0">
        <header className="sticky top-0 z-20 flex h-16 print:hidden items-center gap-3 border-b border-soft-200 bg-white/80 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/80 sm:px-6">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu /></button>
          <div className="min-w-0 flex-1">
            {panel === 'company' ? (
              <div className="flex items-center gap-2">
                <p className="truncate font-display font-bold text-navy-900 dark:text-white">{session.company?.name}</p>
                {session.subscription?.plan && <Badge color="blue">{session.subscription.plan.name}</Badge>}
                {session.subscription?.state === 'trialing' && <Badge color="amber">Trial · ends {date(session.subscription.endsAt)}</Badge>}
              </div>
            ) : <p className="font-display font-bold text-navy-900 dark:text-white">GO SOFT Control Centre</p>}
          </div>
          {panel === 'company' && !['pending', 'suspended', 'blocked'].includes(session.company?.status) && <NotificationBell />}
          <ThemeToggle />
          <UserMenu session={session} panel={panel} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
          {panel === 'company' && !blocked && <Banners session={session} />}
          {blocked ? <BlockingScreen session={session} /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
