import { Link } from 'react-router-dom';
import { Target, Heart, Rocket } from 'lucide-react';
import { Button } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { LogoMark } from '../../components/Logo';

export default function About() {
  return (
    <>
      <Seo title="About" path="/about" description="GO SOFT is India's next-generation business management platform, built and powered by Goyals Group." />
      <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
        <LogoMark size={64} className="mx-auto" />
        <h1 className="mt-8 text-4xl font-extrabold text-navy-900 dark:text-white sm:text-5xl">Built so Indian businesses can <span className="gradient-text">focus on growth</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500">GO SOFT brings billing, HR, payroll and project management together in one intelligent workspace — developed and powered by Goyals Group.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 sm:px-6 md:grid-cols-3">
        {[[Target, 'Our mission', 'Give every business — from a 5-person shop to a 500-person company — the tools large enterprises use, without the complexity or cost.'],
          [Heart, 'What we value', 'Simplicity, reliability and trust. Your data belongs to you, is isolated from everyone else and is never deleted without your say.'],
          [Rocket, 'Where we are going', 'Built for India first — GST, statutory payroll, local workflows — and designed to scale to businesses worldwide.']].map(([Icon, t, d]) => (
          <div key={t} className="card p-7">
            <Icon className="h-7 w-7 text-royal-600 dark:text-electric-400" />
            <h2 className="mt-4 text-lg font-bold text-navy-900 dark:text-white">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{d}</p>
          </div>
        ))}
      </section>
      <section className="pb-24 text-center"><Link to="/register"><Button size="lg">Start your free trial</Button></Link></section>
    </>
  );
}
