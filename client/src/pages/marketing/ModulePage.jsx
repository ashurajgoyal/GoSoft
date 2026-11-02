import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { MODULE_PAGES } from './content';
import { useSite } from '../../lib/site';
import { LayoutGrid } from 'lucide-react';

export default function ModulePage() {
  const { slug } = useParams();
  const site = useSite();
  const icon = (s) => MODULE_PAGES.find((x) => x.slug === s)?.icon || LayoutGrid;
  const pages = site.landingPages?.length ? site.landingPages.map((p) => ({ ...p, icon: icon(p.slug) })) : MODULE_PAGES;
  const m = pages.find((x) => x.slug === slug);
  if (!m) return site.loaded || !site.landingPages ? <Navigate to="/features" replace /> : null;
  const others = pages.filter((x) => x.slug !== slug).slice(0, 4);
  return (
    <>
      <Seo title={m.title} path={`/software/${m.slug}`} description={m.seoDescription || m.intro}
        schema={{ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: `GO SOFT ${m.name}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: m.intro }} />
      <section className="relative -mt-16 overflow-hidden bg-navy-950 pb-20 pt-36 text-white">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-royal-600/30 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mx-auto inline-flex rounded-2xl bg-white/10 p-4"><m.icon className="h-8 w-8 text-electric-300" /></div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-electric-300">{m.title}</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">{m.h1}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">{m.intro}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button size="lg">Start Free Trial</Button></Link>
            <Link to="/book-demo"><Button size="lg" variant="outlineLight">Book a Demo</Button></Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-navy-900 dark:text-white">What you get</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {m.points.map((p) => (
            <div key={p} className="card flex gap-3 p-5"><CheckCircle2 className="h-5 w-5 shrink-0 text-royal-600 dark:text-electric-400" /><span className="text-sm font-medium">{p}</span></div>
          ))}
        </div>
      </section>
      <section className="bg-white py-16 dark:bg-navy-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-xl font-bold text-navy-900 dark:text-white">Works together with</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((o) => (
              <Link key={o.slug} to={`/software/${o.slug}`} className="card group p-5 transition hover:border-royal-500/40">
                <o.icon className="h-5 w-5 text-royal-600 dark:text-electric-400" />
                <p className="mt-3 font-semibold text-navy-900 dark:text-white">{o.name}</p>
                <p className="mt-1 text-xs text-slate-500">{o.short}</p>
                <ArrowRight className="mt-3 h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
