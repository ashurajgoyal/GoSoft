import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, Bell, Smartphone, Moon, FileDown, Building2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { MODULE_PAGES } from './content';

export default function Features() {
  return (
    <>
      <Seo title="Features" path="/features" description="Explore GO SOFT features: GST billing, HRMS, payroll, attendance, leave, task and project management, role-based access and analytics." />
      <section className="relative -mt-16 overflow-hidden bg-navy-950 pb-20 pt-36 text-center text-white">
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-extrabold sm:text-5xl">Every tool your business runs on — <span className="gradient-text">connected</span></h1>
          <p className="mt-5 text-lg text-white/70">Billing, people, payroll and projects that share one source of truth.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-20 sm:px-6">
        {MODULE_PAGES.map((m, i) => (
          <div key={m.slug} className={`card grid items-center gap-8 p-8 lg:grid-cols-2 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
            <div>
              <div className="inline-flex rounded-xl bg-gradient-to-br from-royal-600 to-electric-500 p-3 text-white"><m.icon className="h-6 w-6" /></div>
              <h2 className="mt-4 text-2xl font-extrabold text-navy-900 dark:text-white">{m.name}</h2>
              <p className="mt-2 text-slate-500">{m.intro}</p>
              <Link to={`/software/${m.slug}`} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-royal-600 dark:text-electric-400">Learn more <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {m.points.map((p) => <li key={p} className="flex gap-2.5 rounded-xl bg-soft-50 p-3 text-sm dark:bg-white/5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-royal-600 dark:text-electric-400" />{p}</li>)}
            </ul>
          </div>
        ))}
      </section>

      <section className="bg-white py-20 dark:bg-navy-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-navy-900 dark:text-white">Platform capabilities</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[[ShieldCheck, 'Role-based access control', 'Default roles plus custom roles with view, create, edit, approve and export permissions at own, team, department or company scope.'],
              [Building2, 'Multi-tenant isolation', 'Each company gets an independent workspace with server-side isolation on every request.'],
              [Bell, 'Smart notifications', 'In-app and email alerts for approvals, invoices, payroll and tasks, with optional WhatsApp/SMS.'],
              [FileDown, 'Exports everywhere', 'Excel, CSV and PDF exports across billing, HR and payroll reports.'],
              [Smartphone, 'Responsive by design', 'A fast, modern interface that works on desktop, tablet and mobile.'],
              [Moon, 'Light & dark mode', 'Comfortable to use all day, whichever you prefer.']].map(([Icon, t, d]) => (
              <div key={t} className="card p-6">
                <Icon className="h-6 w-6 text-royal-600 dark:text-electric-400" />
                <h3 className="mt-4 font-bold text-navy-900 dark:text-white">{t}</h3>
                <p className="mt-2 text-sm text-slate-500">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center"><Link to="/register"><Button size="lg">Start Free Trial <ArrowRight className="h-4 w-4" /></Button></Link></div>
        </div>
      </section>
    </>
  );
}
