import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { Button, PageLoader, cx } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { api } from '../../lib/api';
import { inr, limitLabel } from '../../lib/format';
import { FAQS } from './content';

export default function Pricing() {
  const [annual, setAnnual] = useState(true);
  const { data, isLoading } = useQuery({ queryKey: ['public-plans'], queryFn: () => api('/public/plans') });
  const plans = data?.data || [];
  const modules = data?.modules || {};

  return (
    <>
      <Seo title="Pricing" path="/pricing" description="Simple, transparent pricing for GO SOFT billing, HRMS, payroll and task management software. Start with a free trial." />
      <section className="relative -mt-16 overflow-hidden bg-navy-950 pb-32 pt-36 text-center text-white">
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-extrabold sm:text-5xl">Plans that grow <span className="gradient-text">with you</span></h1>
          <p className="mt-4 text-white/70">Every plan starts with a free trial. No credit card required.</p>
          <div className="mt-8 inline-flex rounded-xl bg-white/10 p-1 text-sm font-semibold">
            <button onClick={() => setAnnual(false)} className={cx('rounded-lg px-5 py-2 transition', !annual && 'bg-white text-navy-900')}>Monthly</button>
            <button onClick={() => setAnnual(true)} className={cx('rounded-lg px-5 py-2 transition', annual && 'bg-white text-navy-900')}>Annual <span className="ml-1 text-xs text-emerald-400">Save ~17%</span></button>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-20 max-w-7xl px-4 pb-20 sm:px-6">
        {isLoading ? <PageLoader /> : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p._id} className={cx('card relative flex flex-col p-7', p.highlighted && 'ring-2 ring-royal-600 lg:-translate-y-3')}>
                {p.highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-royal-600 px-3 py-1 text-xs font-bold text-white">Most popular</span>}
                <h2 className="text-lg font-bold text-navy-900 dark:text-white">{p.name}</h2>
                <p className="mt-1 min-h-10 text-sm text-slate-500">{p.tagline}</p>
                <p className="mt-5 font-display text-4xl font-extrabold text-navy-900 dark:text-white">
                  {inr(annual ? Math.round(p.priceAnnual / 12) : p.priceMonthly)}<span className="text-sm font-medium text-slate-500">/month</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{annual ? `${inr(p.priceAnnual)} billed yearly` : 'Billed monthly'} · + GST</p>
                <Link to={`/register?plan=${p.slug}`} className="mt-6"><Button variant={p.highlighted ? 'primary' : 'secondary'} className="w-full">Start {p.trialDays}-day free trial</Button></Link>
                <ul className="mt-7 space-y-3 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2.5"><Check className="h-4 w-4 shrink-0 text-royal-600 dark:text-electric-400" />{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}

        {plans.length > 0 && (
          <div className="card mt-16 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-soft-200 dark:border-white/10">
                <tr><th className="th">Compare plans</th>{plans.map((p) => <th key={p._id} className="th text-center">{p.name}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-soft-200 dark:divide-white/10">
                {[['Users', 'users'], ['Employees', 'employees'], ['Invoices / month', 'invoicesPerMonth'], ['Branches', 'branches']].map(([l, k]) => (
                  <tr key={k}><td className="td font-medium">{l}</td>{plans.map((p) => <td key={p._id} className="td text-center">{limitLabel(p.limits?.[k])}</td>)}</tr>
                ))}
                <tr><td className="td font-medium">Storage</td>{plans.map((p) => <td key={p._id} className="td text-center">{p.limits?.storageMB >= 1024 ? `${Math.round(p.limits.storageMB / 1024)} GB` : `${p.limits?.storageMB} MB`}</td>)}</tr>
                {Object.entries(modules).filter(([, m]) => !m.alwaysOn).map(([k, m]) => (
                  <tr key={k}><td className="td font-medium">{m.label}</td>{plans.map((p) => (
                    <td key={p._id} className="td text-center">{p.modules.includes(k) ? <Check className="mx-auto h-4 w-4 text-emerald-500" /> : <X className="mx-auto h-4 w-4 text-slate-300" />}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center text-2xl font-extrabold text-navy-900 dark:text-white">Pricing questions</h2>
          <div className="mt-8 space-y-4">
            {FAQS.filter((_, i) => [2, 4, 0].includes(i)).map(([q, a]) => (
              <div key={q} className="card p-5"><h3 className="font-semibold text-navy-900 dark:text-white">{q}</h3><p className="mt-2 text-sm text-slate-500">{a}</p></div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">Need custom limits or on-boarding help? <Link to="/book-demo" className="font-semibold text-royal-600">Talk to our team</Link></p>
        </div>
      </section>
    </>
  );
}
