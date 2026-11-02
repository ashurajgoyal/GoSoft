import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { Seo } from '../../components/Seo';
import { Button, PageLoader, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { date } from '../../lib/format';
import { renderMarkdown } from '../../lib/markdown';

function PostCard({ p }) {
  return (
    <Link to={`/blog/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      {p.coverImage ? <img src={p.coverImage} alt="" loading="lazy" className="h-44 w-full object-cover" /> : <div className="h-44 bg-gradient-to-br from-navy-900 via-royal-600 to-electric-500" />}
      <div className="flex flex-1 flex-col p-5">
        {p.category && <p className="text-xs font-semibold uppercase tracking-wide text-royal-600 dark:text-electric-400">{p.category.name}</p>}
        <h2 className="mt-2 text-lg font-bold text-navy-900 group-hover:text-royal-600 dark:text-white">{p.title}</h2>
        <p className="mt-2 flex-1 text-sm text-slate-500">{p.excerpt}</p>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">{date(p.publishAt)} · <Clock className="h-3 w-3" />{p.readingMinutes || 1} min read</p>
      </div>
    </Link>
  );
}

export function BlogIndex() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const page = Number(params.get('page')) || 1;
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['public-blog', category, page, q], queryFn: () => api('/public/blog', { query: { category, page, q } }) });
  return (
    <>
      <Seo title="Blog — Billing, HR, Payroll & Growth Guides" path="/blog" description="Practical guides on GST billing, HRMS, payroll, attendance, productivity and growing your business in India." />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center"><p className="text-sm font-semibold uppercase tracking-wider text-royal-600 dark:text-electric-400">GO SOFT Blog</p>
          <h1 className="mt-3 text-4xl font-extrabold text-navy-900 dark:text-white">Guides to run your business better</h1>
          <input className="input mx-auto mt-6 max-w-md" placeholder="Search articles" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[{ name: 'All', slug: '' }, ...(data?.categories || [])].map((c) => <button key={c.slug} onClick={() => setParams(c.slug ? { category: c.slug } : {})} className={cx('rounded-full px-4 py-1.5 text-sm font-medium', category === c.slug ? 'bg-royal-600 text-white' : 'bg-white text-slate-600 dark:bg-white/5 dark:text-slate-300')}>{c.name}</button>)}
        </div>
        {isLoading ? <PageLoader /> : !data?.data?.length ? <p className="mt-16 text-center text-slate-500">No articles found.</p> : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{data.data.map((p) => <PostCard key={p._id} p={p} />)}</div>
        )}
        {data?.meta?.pages > 1 && <div className="mt-10 flex justify-center gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setParams({ ...(category && { category }), page: page - 1 })}>Previous</Button>
          <Button variant="secondary" disabled={page >= data.meta.pages} onClick={() => setParams({ ...(category && { category }), page: page + 1 })}>Next</Button></div>}
      </section>
    </>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ['public-post', slug], queryFn: () => api(`/public/blog/${slug}`), retry: false });
  if (isLoading) return <PageLoader />;
  if (isError) return <div className="py-32 text-center"><h1 className="text-2xl font-bold">Article not found</h1><Link to="/blog"><Button className="mt-6">Back to blog</Button></Link></div>;
  const p = data.data;
  return (
    <>
      <Seo title={p.seo?.title || p.title} path={`/blog/${p.slug}`} description={p.seo?.description || p.excerpt} canonical={p.seo?.canonical}
        schema={{ '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.excerpt, datePublished: p.publishAt, dateModified: p.updatedAt, author: { '@type': 'Organization', name: p.author?.name || 'GO SOFT' }, publisher: { '@type': 'Organization', name: 'GO SOFT by Goyals Group' }, image: p.coverImage || undefined }} />
      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-royal-600"><ArrowLeft className="h-4 w-4" />All articles</Link>
        {p.category && <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-royal-600 dark:text-electric-400">{p.category.name}</p>}
        <h1 className="mt-2 text-4xl font-extrabold leading-tight text-navy-900 dark:text-white">{p.title}</h1>
        <p className="mt-4 text-sm text-slate-500">{p.author?.name} · {date(p.publishAt)} · {p.readingMinutes || 1} min read</p>
        {p.coverImage && <img src={p.coverImage} alt="" className="mt-8 w-full rounded-2xl" />}
        <div className="prose-gs mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
        {p.tags?.length > 0 && <div className="mt-8 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className="rounded-full bg-soft-100 px-3 py-1 text-xs dark:bg-white/10">#{t}</span>)}</div>}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-navy-900 to-royal-600 p-8 text-center text-white"><h2 className="text-2xl font-extrabold">Run billing, HR and payroll in one place</h2><p className="mt-2 text-white/80">Start your free GO SOFT trial — no credit card required.</p><Link to="/register"><Button variant="light" className="mt-5">Start free trial <ArrowRight className="h-4 w-4" /></Button></Link></div>
        {data.related?.length > 0 && <><h2 className="mb-5 mt-14 text-xl font-bold">Related articles</h2><div className="grid gap-5 sm:grid-cols-3">{data.related.map((r) => <PostCard key={r._id} p={r} />)}</div></>}
      </article>
    </>
  );
}
