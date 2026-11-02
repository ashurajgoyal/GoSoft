import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, PlayCircle, Sparkles, ShieldCheck, Zap, IndianRupee, Lock, Layers, CheckCircle2, ChevronDown,
  TrendingUp, Users, Receipt, Clock, Building2, Smartphone,
} from 'lucide-react';
import { Button } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { api } from '../../lib/api';
import { inr } from '../../lib/format';
import { MODULE_PAGES, FAQS as DEFAULT_FAQS } from './content';
import { useSite } from '../../lib/site';
import { Quote } from 'lucide-react';

function DashboardPreview() {
  const bars = [40, 62, 48, 75, 58, 88, 70, 95, 80, 100, 86, 92];
  return (
    <div className="relative mx-auto max-w-5xl animate-fade-up [animation-delay:.2s]">
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-royal-600/40 via-electric-500/30 to-royal-600/40 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-navy-900/90 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/80" /><span className="h-3 w-3 rounded-full bg-amber-400/80" /><span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <span className="ml-3 rounded-md bg-white/5 px-3 py-1 text-xs text-white/50">app.gosoft.in/dashboard</span>
        </div>
        <div className="grid gap-4 p-5 text-left md:grid-cols-[180px_1fr]">
          <div className="hidden space-y-1.5 md:block">
            {['Dashboard', 'Billing', 'Employees', 'Attendance', 'Payroll', 'Tasks', 'Reports'].map((l, i) => (
              <div key={l} className={`rounded-lg px-3 py-2 text-xs ${i === 0 ? 'bg-royal-600 text-white' : 'text-white/50'}`}>{l}</div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[['Revenue (MTD)', '₹8.42L', '+12.4%', Receipt], ['Employees', '64', '+3', Users], ['Present today', '58', '91%', Clock], ['Open tasks', '27', '-8', TrendingUp]].map(([l, v, d, Icon]) => (
                <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-[11px] text-white/50">{l}<Icon className="h-3.5 w-3.5" /></div>
                  <div className="mt-1.5 font-display text-lg font-bold text-white">{v}</div>
                  <div className="text-[11px] text-emerald-400">{d}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
                <div className="mb-3 text-xs font-semibold text-white/70">Monthly revenue</div>
                <div className="flex h-28 items-end gap-1.5">
                  {bars.map((h, i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-royal-600 to-electric-400" style={{ height: `${h}%` }} />)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-xs font-semibold text-white/70">Today</div>
                {['Payroll approved', 'Invoice #INV-0142 paid', '3 leave requests', 'Sprint review 4 PM'].map((t, i) => (
                  <div key={t} className="mb-2 flex items-center gap-2 text-[11px] text-white/60"><span className={`h-1.5 w-1.5 rounded-full ${['bg-emerald-400', 'bg-electric-400', 'bg-amber-400', 'bg-violet-400'][i]}`} />{t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -left-6 top-1/3 hidden animate-float rounded-2xl border border-white/15 bg-white p-3 shadow-xl dark:bg-navy-800 md:block">
        <div className="flex items-center gap-2 text-xs font-semibold text-navy-900 dark:text-white"><CheckCircle2 className="h-4 w-4 text-emerald-500" />GST invoice sent</div>
      </div>
      <div className="absolute -right-6 bottom-12 hidden animate-float rounded-2xl border border-white/15 bg-white p-3 shadow-xl [animation-delay:1.5s] dark:bg-navy-800 md:block">
        <div className="text-[11px] text-slate-500">Payroll · November</div>
        <div className="font-display text-sm font-bold text-navy-900 dark:text-white">64 payslips ready</div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold text-navy-900 dark:text-white">
        {q}<ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>}
    </div>
  );
}

export default function Home() {
  const { data } = useQuery({ queryKey: ['public-plans'], queryFn: () => api('/public/plans') });
  const plans = data?.data || [];
  const site = useSite();
  const FAQS = site.faqs?.length ? site.faqs.map((f) => [f.q, f.a]) : DEFAULT_FAQS;
  const hero = { badge: "India's Next-Generation Business Management Platform", headline: 'One Platform. Complete Business Control.', subheadline: "Manage billing, employees, payroll, attendance and tasks with GO SOFT — India's next-generation business management software.", ...Object.fromEntries(Object.entries(site.hero || {}).filter(([, v]) => v)) };
  const [h1a, ...h1rest] = hero.headline.split('. ');

  return (
    <>
      <Seo
        description="Manage billing, employees, payroll, attendance and tasks with GO SOFT — India's next-generation business management software. Start your free trial."
        schema={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }}
      />

      {/* Hero */}
      <section className="relative -mt-16 overflow-hidden bg-navy-950 pb-24 pt-36 text-white">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-royal-600/30 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
          <div className="mx-auto inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-electric-300">
            <Sparkles className="h-3.5 w-3.5" /> {hero.badge}
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl animate-fade-up text-4xl font-extrabold leading-[1.08] sm:text-6xl lg:text-7xl">
            {h1rest.length ? <>{h1a}.<br /><span className="gradient-text">{h1rest.join('. ')}</span></> : <span className="gradient-text">{hero.headline}</span>}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg text-white/70 [animation-delay:.1s]">
            {hero.subheadline}
          </p>
          <div className="mt-9 flex animate-fade-up flex-wrap justify-center gap-3 [animation-delay:.15s]">
            <Link to="/register"><Button size="lg" className="shadow-xl shadow-royal-600/40">Start Free Trial <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/book-demo"><Button size="lg" variant="light" icon={PlayCircle}>Book a Demo</Button></Link>
            <Link to="/features"><Button size="lg" variant="outlineLight">Explore Features</Button></Link>
          </div>
          <p className="mt-4 text-xs text-white/50">Free trial · No credit card required · Set up in minutes</p>
          <div className="mt-16"><DashboardPreview /></div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-soft-200 bg-white py-8 dark:border-white/10 dark:bg-navy-900">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 md:grid-cols-4">
          {[[IndianRupee, 'GST-ready billing'], [ShieldCheck, 'Role-based security'], [Building2, 'Isolated company workspaces'], [Smartphone, 'Works on any device']].map(([Icon, t]) => (
            <div key={t} className="flex items-center justify-center gap-2.5"><Icon className="h-5 w-5 text-royal-600 dark:text-electric-400" />{t}</div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-royal-600 dark:text-electric-400">Everything you need</p>
          <h2 className="mt-3 text-3xl font-extrabold text-navy-900 dark:text-white sm:text-4xl">Eight tools. One login. Zero chaos.</h2>
          <p className="mt-4 text-slate-500">Replace scattered apps and spreadsheets with one connected platform where billing, people and projects share the same data.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_PAGES.map((m) => (
            <Link key={m.slug} to={`/software/${m.slug}`} className="card group p-6 transition hover:-translate-y-1 hover:border-royal-500/40 hover:shadow-xl hover:shadow-royal-600/10">
              <div className="inline-flex rounded-xl bg-gradient-to-br from-royal-600 to-electric-500 p-3 text-white shadow-lg shadow-royal-600/30"><m.icon className="h-5 w-5" /></div>
              <h3 className="mt-5 font-bold text-navy-900 dark:text-white">{m.name}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{m.short}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-royal-600 opacity-0 transition group-hover:opacity-100 dark:text-electric-400">Learn more <ArrowRight className="h-4 w-4" /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="bg-white py-24 dark:bg-navy-900">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-royal-600 dark:text-electric-400">Built for trust</p>
            <h2 className="mt-3 text-3xl font-extrabold text-navy-900 dark:text-white sm:text-4xl">Enterprise-grade control, small-business simplicity</h2>
            <p className="mt-4 text-slate-500">GO SOFT enforces every rule on the server — not just in the interface — so your data is protected no matter how it is accessed.</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {[[Lock, 'Strict data isolation', 'Every company works in its own workspace. No one outside it can see your data.'],
                [ShieldCheck, 'Granular permissions', 'Decide exactly who can view, create, approve or export — down to own, team or company scope.'],
                [Layers, 'Complete audit trail', 'Every important change is logged with who, what and when.'],
                [Zap, 'Fast & always on', 'Modern cloud architecture that is quick on any device and connection.']].map(([Icon, t, d]) => (
                <div key={t}>
                  <div className="inline-flex rounded-lg bg-royal-600/10 p-2 text-royal-600 dark:text-electric-400"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-3 font-semibold text-navy-900 dark:text-white">{t}</h3>
                  <p className="mt-1 text-sm text-slate-500">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-royal-600 to-electric-500 opacity-20 blur-2xl" />
            <div className="card relative space-y-3 p-6">
              <p className="text-sm font-semibold text-navy-900 dark:text-white">Role: Accountant</p>
              {[['Create invoices', true], ['Manage customers', true], ['Export billing records', true], ['Approve payroll', false], ['Manage company users', false]].map(([p, ok]) => (
                <div key={p} className="flex items-center justify-between rounded-xl bg-soft-50 px-4 py-3 text-sm dark:bg-white/5">
                  {p}<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-200 text-slate-500 dark:bg-white/10'}`}>{ok ? 'Allowed' : 'No access'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-navy-900 dark:text-white sm:text-4xl">Up and running in three steps</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[['01', 'Create your workspace', 'Sign up with your business details and start your free trial instantly.'],
            ['02', 'Invite your team', 'Add users and assign ready-made roles like HR Manager, Accountant or Employee.'],
            ['03', 'Run your business', 'Bill customers, manage people and track work — all from one dashboard.']].map(([n, t, d]) => (
            <div key={n} className="card relative overflow-hidden p-7">
              <span className="absolute -right-2 -top-4 font-display text-8xl font-extrabold text-royal-600/5 dark:text-white/5">{n}</span>
              <span className="font-display text-sm font-bold text-royal-600 dark:text-electric-400">{n}</span>
              <h3 className="mt-2 text-lg font-bold text-navy-900 dark:text-white">{t}</h3>
              <p className="mt-2 text-sm text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      {plans.length > 0 && (
        <section className="bg-white py-24 dark:bg-navy-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-navy-900 dark:text-white sm:text-4xl">Simple, transparent pricing</h2>
              <p className="mt-3 text-slate-500">Start free. Upgrade when you are ready. Prices exclude GST.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((p) => (
                <div key={p._id} className={`card p-6 ${p.highlighted ? 'ring-2 ring-royal-600' : ''}`}>
                  <h3 className="font-bold text-navy-900 dark:text-white">{p.name}</h3>
                  <p className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-white">{inr(p.priceMonthly)}<span className="text-sm font-medium text-slate-500">/mo</span></p>
                  <p className="mt-2 text-sm text-slate-500">{p.tagline}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center"><Link to="/pricing"><Button variant="secondary">Compare all plans <ArrowRight className="h-4 w-4" /></Button></Link></div>
          </div>
        </section>
      )}

      {site.testimonials?.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-navy-900 dark:text-white sm:text-4xl">What our customers say</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">{site.testimonials.map((t, i) => (
            <figure key={i} className="card p-6"><Quote className="h-6 w-6 text-royal-600" /><blockquote className="mt-3 text-slate-600 dark:text-slate-300">{t.quote}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">{t.photoUrl && <img src={t.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}<span><b className="block text-sm text-navy-900 dark:text-white">{t.name}</b><span className="text-xs text-slate-500">{[t.role, t.company].filter(Boolean).join(', ')}</span></span></figcaption></figure>))}</div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-navy-900 dark:text-white sm:text-4xl">Frequently asked questions</h2>
        <div className="mt-10 space-y-3">{FAQS.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}</div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-royal-700 to-electric-500 px-8 py-16 text-center text-white">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold sm:text-4xl">Business Simplified. Growth Amplified.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">Join businesses across India running billing, HR, payroll and projects on GO SOFT.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register"><Button size="lg" variant="light">Start Free Trial</Button></Link>
              <Link to="/book-demo"><Button size="lg" variant="outlineLight">Talk to Sales</Button></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
