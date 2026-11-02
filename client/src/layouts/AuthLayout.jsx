import { Outlet } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-navy-950 p-12 text-white lg:flex lg:flex-col">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-royal-600/40 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-electric-500/30 blur-3xl" />
        <div className="relative"><Logo light showTagline /></div>
        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">One Platform.<br /><span className="gradient-text">Complete Business Control.</span></h2>
          <p className="mt-4 text-white/70">Billing, employees, payroll, attendance and tasks — in one secure workspace built for Indian businesses.</p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {['GST-ready billing with CGST, SGST & IGST', 'HRMS, attendance & leave in one place', 'Payroll with configurable PF, ESI, TDS & PT', 'Role-based access for every team member', 'Bank-grade security & strict data isolation'].map((t) => (
              <li key={t} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-electric-400" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">Business Simplified. Growth Amplified.</p>
      </aside>
      <main className="flex flex-col">
        <div className="flex items-center justify-between p-5 lg:justify-end">
          <span className="lg:hidden"><Logo /></span>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-md animate-fade-up"><Outlet /></div>
        </div>
      </main>
    </div>
  );
}
