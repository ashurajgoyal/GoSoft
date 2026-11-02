import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, MessageCircle, ArrowRight, Phone, MapPin, Mail } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useSite } from '../lib/site';
import { Logo } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { Button } from '../components/ui';
import { MODULE_PAGES } from '../pages/marketing/content';

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', on);
    return () => window.removeEventListener('scroll', on);
  }, []);

  const link = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'text-royal-600 dark:text-electric-400' : 'text-slate-600 hover:text-navy-900 dark:text-slate-300 dark:hover:text-white'}`;

  return (
    <header className={`sticky top-0 z-40 transition ${scrolled ? 'border-b border-soft-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-navy-950/80' : 'bg-transparent'}`}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-1 lg:flex">
          <NavLink to="/features" className={link}>Features</NavLink>
          <div className="group relative">
            <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-navy-900 dark:text-slate-300 dark:hover:text-white">
              Software <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-1/2 top-full w-[520px] -translate-x-1/2 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="card grid grid-cols-2 gap-1 p-2 shadow-xl">
                {MODULE_PAGES.map((m) => (
                  <Link key={m.slug} to={`/software/${m.slug}`} className="flex gap-3 rounded-xl p-3 hover:bg-soft-50 dark:hover:bg-white/5">
                    <span className="mt-0.5 rounded-lg bg-royal-600/10 p-2 text-royal-600 dark:text-electric-400"><m.icon className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-sm font-semibold text-navy-900 dark:text-white">{m.name}</span>
                      <span className="block text-xs text-slate-500">{m.short}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <NavLink to="/pricing" className={link}>Pricing</NavLink>
          <NavLink to="/blog" className={link}>Blog</NavLink>
          <NavLink to="/about" className={link}>About</NavLink>
          <NavLink to="/contact" className={link}>Contact</NavLink>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Link to="/login" className="px-3 py-2 text-sm font-semibold text-navy-900 hover:text-royal-600 dark:text-white">Log in</Link>
          <Link to="/register"><Button>Start Free Trial</Button></Link>
        </div>
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button onClick={() => setOpen(!open)} className="rounded-lg p-2" aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-soft-200 bg-white px-4 pb-6 pt-2 dark:border-white/10 dark:bg-navy-950 lg:hidden">
          {[['Features', '/features'], ...MODULE_PAGES.map((m) => [m.name, `/software/${m.slug}`]), ['Pricing', '/pricing'], ['Blog', '/blog'], ['About', '/about'], ['Contact', '/contact'], ['Log in', '/login']].map(([l, to]) => (
            <Link key={to} to={to} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-soft-100 dark:hover:bg-white/5">{l}</Link>
          ))}
          <Link to="/register"><Button className="mt-3 w-full">Start Free Trial</Button></Link>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const site = useSite();
  const c = site.contact;
  const cols = [
    ['Product', [['Features', '/features'], ['Pricing', '/pricing'], ['Book a Demo', '/book-demo'], ['Free Trial', '/register']]],
    ['Software', MODULE_PAGES.slice(0, 6).map((m) => [m.name, `/software/${m.slug}`])],
    ['Company', [['About', '/about'], ['Blog', '/blog'], ['Contact', '/contact'], ['Log in', '/login']]],
    ['Legal', [['Privacy Policy', '/legal/privacy-policy'], ['Terms of Service', '/legal/terms'], ['Refund Policy', '/legal/refund-policy'], ['Cancellation Policy', '/legal/cancellation-policy']]],
  ];
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-slate-400">
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo light showTagline />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">{site.footer?.about || "India's next-generation business management platform — billing, HRMS, payroll, attendance and tasks in one intelligent workspace."}</p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-electric-400" /><a href={`tel:${c.phone}`} className="hover:text-white">{c.phone}</a></li>
              <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-electric-400" /><a href={`mailto:${c.email}`} className="hover:text-white">{c.email}</a></li>
              <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electric-400" />{c.address}</li>
            </ul>
            <p className="mt-4 font-display text-sm font-bold text-white">Business Simplified. <span className="text-electric-400">Growth Amplified.</span></p>
          </div>
          {cols.map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-semibold text-white">{title}</h4>
              <ul className="space-y-2.5 text-sm">
                {links.map(([l, to]) => <li key={to}><Link to={to} className="transition hover:text-white">{l}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row">
          <p>{site.footer?.copyright || `© ${new Date().getFullYear()} GO SOFT. All rights reserved.`}</p>
          <div className="flex gap-4">{Object.entries(site.social || {}).filter(([, v]) => v).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noreferrer" className="capitalize hover:text-white">{k}</a>)}</div>
          <p>Powered by <span className="font-semibold text-white">Goyals Group</span> · Made in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}

function NotFound() {
  const site = useSite();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const hit = (site.redirects || []).find((r) => r.from === pathname);
    if (hit) { if (/^https?:/.test(hit.to)) window.location.replace(hit.to); else navigate(hit.to, { replace: true }); }
  }, [site.redirects, pathname, navigate]);
  return (
    <section className="mx-auto max-w-xl px-4 py-32 text-center">
      <p className="font-display text-7xl font-extrabold gradient-text">404</p>
      <h1 className="mt-4 text-2xl font-bold text-navy-900 dark:text-white">This page could not be found</h1>
      <p className="mt-2 text-slate-500">The link may be broken or the page may have moved.</p>
      <Link to="/"><Button className="mt-8" icon={ArrowRight}>Back to home</Button></Link>
    </section>
  );
}

export default function MarketingLayout({ notFound }) {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  const site = useSite();
  const wa = site.contact?.whatsapp || import.meta.env.VITE_WHATSAPP_NUMBER;
  return (
    <div className="flex min-h-screen flex-col">
      <Helmet>{site.seo?.googleSiteVerification && <meta name="google-site-verification" content={site.seo.googleSiteVerification} />}{site.brand?.faviconUrl && <link rel="icon" href={site.brand.faviconUrl} />}</Helmet>
      {site.announcement?.enabled && site.announcement.text && (
        <div className="relative z-50 bg-gradient-to-r from-royal-700 to-electric-500 px-4 py-2 text-center text-sm font-medium text-white">
          {site.announcement.link ? <a href={site.announcement.link} className="underline-offset-2 hover:underline">{site.announcement.text} →</a> : site.announcement.text}
        </div>
      )}
      <Navbar />
      <main className="flex-1">{notFound ? <NotFound /> : <Outlet />}</main>
      <Footer />
      {wa && (
        <a href={`https://wa.me/${wa.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I would like to know more about GO SOFT.')}`} target="_blank" rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 transition hover:scale-105" aria-label="Chat on WhatsApp">
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}
