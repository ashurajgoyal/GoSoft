import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { refreshSession } from './lib/api';
import { PageLoader } from './components/ui';
import MarketingLayout from './layouts/MarketingLayout';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';

import Home from './pages/marketing/Home';
const Features = lazy(() => import('./pages/marketing/Features'));
const Pricing = lazy(() => import('./pages/marketing/Pricing'));
const Contact = lazy(() => import('./pages/marketing/Contact'));
const About = lazy(() => import('./pages/marketing/About'));
const Legal = lazy(() => import('./pages/marketing/Legal'));
const ModulePage = lazy(() => import('./pages/marketing/ModulePage'));
const BlogIndex = lazy(() => import('./pages/marketing/Blog').then((m) => ({ default: m.BlogIndex })));
const BlogPost = lazy(() => import('./pages/marketing/Blog').then((m) => ({ default: m.BlogPost })));

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminCompanies = lazy(() => import('./pages/admin/Companies'));
const AdminCompanyDetail = lazy(() => import('./pages/admin/CompanyDetail'));
const AdminPlans = lazy(() => import('./pages/admin/Plans'));
const AdminPolicies = lazy(() => import('./pages/admin/Policies'));
const AdminAudit = lazy(() => import('./pages/admin/AuditLogs'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));

const CompanyDashboard = lazy(() => import('./pages/company/Dashboard'));
const CompanyUsers = lazy(() => import('./pages/company/Users'));
const CompanyRoles = lazy(() => import('./pages/company/Roles'));
const CompanySettings = lazy(() => import('./pages/company/Settings'));
const CompanySubscription = lazy(() => import('./pages/company/Subscription'));
const CompanyAudit = lazy(() => import('./pages/company/AuditLogs'));
const ModuleComingSoon = lazy(() => import('./pages/company/ModuleComingSoon'));
const Profile = lazy(() => import('./pages/company/Profile'));
const MyHome = lazy(() => import('./pages/company/MyHome'));
const Announcements = lazy(() => import('./pages/company/Announcements'));
const Analytics = lazy(() => import('./pages/company/Analytics'));

const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const billing = () => import('./pages/billing/Masters');
const Customers = named(billing, 'Customers');
const Vendors = named(billing, 'Vendors');
const Products = named(billing, 'Products');
const Expenses = named(billing, 'Expenses');
const Invoices = lazy(() => import('./pages/billing/Invoices'));
const InvoiceEditor = lazy(() => import('./pages/billing/InvoiceEditor'));
const InvoiceView = lazy(() => import('./pages/billing/InvoiceView'));
const BillingReports = lazy(() => import('./pages/billing/Reports'));
const Ledger = lazy(() => import('./pages/billing/Ledger'));
const BillingSettings = lazy(() => import('./pages/billing/Settings'));

const hr = () => import('./pages/hr/Masters');
const Employees = named(hr, 'Employees');
const Departments = named(hr, 'Departments');
const Holidays = named(hr, 'Holidays');
const LeaveTypes = named(hr, 'LeaveTypes');
const HrSettings = named(hr, 'HrSettings');
const Attendance = lazy(() => import('./pages/hr/Attendance'));
const Leaves = lazy(() => import('./pages/hr/Leaves'));
const Requests = lazy(() => import('./pages/hr/Requests'));

const payroll = () => import('./pages/payroll/Payroll');
const PayrollRuns = named(payroll, 'PayrollRuns');
const PayrollRun = named(payroll, 'PayrollRun');
const PayslipView = named(payroll, 'PayslipView');
const PayrollSettings = named(payroll, 'PayrollSettings');
const Tasks = lazy(() => import('./pages/work/Tasks'));
const Projects = lazy(() => import('./pages/work/Projects'));

const AdminGateway = lazy(() => import('./pages/admin/Gateway'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const AdminCoupons = named(() => import('./pages/admin/Payments'), 'Coupons');
const AdminBlogList = named(() => import('./pages/admin/Blog'), 'BlogList');
const AdminBlogEditor = named(() => import('./pages/admin/Blog'), 'BlogEditor');
const AdminWebsite = lazy(() => import('./pages/admin/Website'));

function RequireAuth({ panel, children }) {
  const session = useAuth((s) => s.session);
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (panel && session.panel !== panel) return <Navigate to={session.panel === 'super_admin' ? '/admin' : '/app'} replace />;
  return children;
}

function GuestOnly({ children }) {
  const session = useAuth((s) => s.session);
  if (session) return <Navigate to={session.panel === 'super_admin' ? '/admin' : '/app'} replace />;
  return children;
}

export default function App() {
  const ready = useAuth((s) => s.ready);

  useEffect(() => {
    refreshSession().catch(() => {}).finally(() => useAuth.getState().setReady());
  }, []);

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><PageLoader /></div>;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<Home />} />
          <Route path="features" element={<Features />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="book-demo" element={<Contact demo />} />
          <Route path="software/:slug" element={<ModulePage />} />
          <Route path="legal/:slug" element={<Legal />} />
          <Route path="blog" element={<BlogIndex />} />
          <Route path="blog/:slug" element={<BlogPost />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="free-trial" element={<Navigate to="/register" replace />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="accept-invite" element={<ResetPassword invite />} />
          <Route path="verify-email" element={<VerifyEmail />} />
        </Route>

        <Route path="admin" element={<RequireAuth panel="super_admin"><AppLayout panel="super_admin" /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="companies/:id" element={<AdminCompanyDetail />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="policies" element={<AdminPolicies />} />
          <Route path="audit-logs" element={<AdminAudit />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="gateway" element={<AdminGateway />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="blog" element={<AdminBlogList />} />
          <Route path="blog/:id" element={<AdminBlogEditor />} />
          <Route path="website" element={<AdminWebsite />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="app" element={<RequireAuth panel="company"><AppLayout panel="company" /></RequireAuth>}>
          <Route index element={<CompanyDashboard />} />
          <Route path="users" element={<CompanyUsers />} />
          <Route path="roles" element={<CompanyRoles />} />
          <Route path="settings" element={<CompanySettings />} />
          <Route path="subscription" element={<CompanySubscription />} />
          <Route path="audit-logs" element={<CompanyAudit />} />
          <Route path="profile" element={<Profile />} />
          <Route path="m/:module" element={<ModuleComingSoon />} />
          <Route path="me" element={<MyHome />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="billing/invoices" element={<Invoices />} />
          <Route path="billing/invoices/new" element={<InvoiceEditor />} />
          <Route path="billing/invoices/:id" element={<InvoiceView />} />
          <Route path="billing/invoices/:id/edit" element={<InvoiceEditor />} />
          <Route path="billing/customers" element={<Customers />} />
          <Route path="billing/customers/:id/ledger" element={<Ledger />} />
          <Route path="billing/products" element={<Products />} />
          <Route path="billing/vendors" element={<Vendors />} />
          <Route path="billing/expenses" element={<Expenses />} />
          <Route path="billing/reports" element={<BillingReports />} />
          <Route path="billing/settings" element={<BillingSettings />} />
          <Route path="hr/employees" element={<Employees />} />
          <Route path="hr/attendance" element={<Attendance />} />
          <Route path="hr/leaves" element={<Leaves />} />
          <Route path="hr/requests" element={<Requests />} />
          <Route path="hr/departments" element={<Departments />} />
          <Route path="hr/holidays" element={<Holidays />} />
          <Route path="hr/leave-types" element={<LeaveTypes />} />
          <Route path="hr/settings" element={<HrSettings />} />
          <Route path="payroll" element={<PayrollRuns />} />
          <Route path="payroll/runs/:id" element={<PayrollRun />} />
          <Route path="payroll/payslips/:id" element={<PayslipView />} />
          <Route path="payroll/settings" element={<PayrollSettings />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="projects" element={<Projects />} />
        </Route>

        <Route path="*" element={<MarketingLayout notFound />} />
      </Routes>
    </Suspense>
  );
}
