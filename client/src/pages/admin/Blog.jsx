import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Save, Eye, Trash2, ArrowLeft } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Textarea, Tabs, Badge, PageLoader, EmptyState, StatusBadge } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { date } from '../../lib/format';
import { renderMarkdown } from '../../lib/markdown';

export function BlogList() {
  const [status, setStatus] = useState('all');
  const { data, isLoading } = useApiQuery('admin-blog', '/admin/blog/posts', { status, limit: 100 });
  const { data: cats } = useApiQuery('admin-blog-cats', '/admin/blog/categories');
  const [cat, setCat] = useState('');
  const addCat = useApiMutation({ path: '/admin/blog/categories', invalidate: ['admin-blog-cats'], success: 'Category added', onSuccess: () => setCat('') });
  const delCat = useApiMutation({ method: 'DELETE', invalidate: ['admin-blog-cats'], success: 'Category deleted' });
  return (
    <>
      <PageHeader title="Blog" description="Write, schedule and optimise articles for search." actions={<Link to="/admin/blog/new"><Button icon={Plus}>New post</Button></Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <div className="p-4"><Tabs value={status} onChange={setStatus} tabs={['all', 'published', 'scheduled', 'draft'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} /></div>
          {isLoading ? <PageLoader /> : !data?.data?.length ? <EmptyState title="No posts" /> : (
            <div className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((p) => (
              <Link key={p._id} to={`/admin/blog/${p._id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-soft-50 dark:hover:bg-white/5">
                <div><p className="font-semibold">{p.title}</p><p className="text-xs text-slate-500">{p.category?.name || 'Uncategorised'} · {p.publishAt ? date(p.publishAt) : 'Not scheduled'} · {p.views} views</p></div>
                <StatusBadge status={p.status} /></Link>))}</div>)}
        </Card>
        <Card className="h-fit p-5"><h2 className="mb-3 font-bold">Categories</h2>
          {cats?.data?.map((c) => <div key={c._id} className="flex items-center justify-between py-1.5 text-sm">{c.name}<button onClick={() => delCat.mutate({ path: `/admin/blog/categories/${c._id}` })} className="text-slate-400 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>)}
          <div className="mt-3 flex gap-2"><Input placeholder="New category" value={cat} onChange={(e) => setCat(e.target.value)} /><Button disabled={cat.length < 2} onClick={() => addCat.mutate({ body: { name: cat } })} icon={Plus} aria-label="Add" /></div></Card>
      </div>
    </>
  );
}

export function BlogEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { data, isLoading } = useApiQuery(['admin-post', id], `/admin/blog/posts/${id}`, undefined, { enabled: !isNew });
  const { data: cats } = useApiQuery('admin-blog-cats', '/admin/blog/categories');
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', content: '', coverImage: '', category: '', tags: [], status: 'draft', publishAt: '', author: { name: 'GO SOFT Team' }, seo: {} });
  const [tab, setTab] = useState('write');
  useEffect(() => { if (data?.data) setF({ ...data.data, category: data.data.category || '', publishAt: data.data.publishAt ? new Date(data.data.publishAt).toISOString().slice(0, 16) : '', seo: data.data.seo || {} }); }, [data]);
  const save = useApiMutation({ method: isNew ? 'POST' : 'PATCH', path: isNew ? '/admin/blog/posts' : `/admin/blog/posts/${id}`, invalidate: ['admin-blog', 'admin-post'], success: 'Post saved', onSuccess: (r) => isNew && navigate(`/admin/blog/${r.data._id}`, { replace: true }) });
  const del = useApiMutation({ method: 'DELETE', invalidate: ['admin-blog'], success: 'Post deleted', onSuccess: () => navigate('/admin/blog') });
  if (!isNew && isLoading) return <PageLoader />;
  const submit = () => save.mutate({ body: { title: f.title, slug: f.slug || undefined, excerpt: f.excerpt, content: f.content, coverImage: f.coverImage || '', category: f.category || null, tags: f.tags,
    status: f.status, publishAt: f.publishAt ? new Date(f.publishAt) : null, author: { name: f.author?.name || 'GO SOFT Team' }, seo: { title: f.seo.title || undefined, description: f.seo.description || undefined, canonical: f.seo.canonical || undefined } } });
  return (
    <>
      <Link to="/admin/blog" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" />All posts</Link>
      <PageHeader title={isNew ? 'New post' : 'Edit post'} actions={<>{!isNew && f.status !== 'draft' && <a href={`/blog/${f.slug}`} target="_blank" rel="noreferrer"><Button variant="secondary" icon={Eye}>View</Button></a>}
        {!isNew && <Button variant="ghost" icon={Trash2} onClick={() => window.confirm('Delete this post permanently?') && del.mutate({ path: `/admin/blog/posts/${id}` })}>Delete</Button>}<Button icon={Save} loading={save.isPending} onClick={submit}>Save</Button></>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-4 p-5">
          <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea label="Excerpt (shown on listing pages)" value={f.excerpt || ''} onChange={(e) => setF({ ...f, excerpt: e.target.value })} />
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'write', label: 'Write (Markdown)' }, { value: 'preview', label: 'Preview' }]} />
          {tab === 'write' ? <textarea className="input min-h-[420px] font-mono text-sm" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder={'## Heading\n\nWrite your article in Markdown…'} />
            : <article className="prose-gs min-h-[420px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(f.content) }} />}
        </Card>
        <div className="space-y-6">
          <Card className="space-y-4 p-5"><h2 className="font-bold">Publishing</h2>
            <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></Select>
            {f.status !== 'draft' && <Input label="Publish at" type="datetime-local" value={f.publishAt} onChange={(e) => setF({ ...f, publishAt: e.target.value })} hint={f.status === 'published' ? 'Defaults to now' : 'Goes live automatically'} />}
            <Select label="Category" value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Uncategorised</option>{cats?.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select>
            <Input label="Tags" hint="Comma separated" value={(f.tags || []).join(', ')} onChange={(e) => setF({ ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            <Input label="Author" value={f.author?.name || ''} onChange={(e) => setF({ ...f, author: { ...f.author, name: e.target.value } })} />
            <Input label="Featured image URL" value={f.coverImage || ''} onChange={(e) => setF({ ...f, coverImage: e.target.value })} />
            {f.coverImage && <img src={f.coverImage} alt="" className="rounded-xl" />}</Card>
          <Card className="space-y-4 p-5"><h2 className="font-bold">SEO</h2>
            <Input label="URL slug" value={f.slug || ''} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} hint={`/blog/${f.slug || 'auto-from-title'}`} />
            <Input label={`SEO title (${(f.seo.title || '').length}/70)`} maxLength={70} value={f.seo.title || ''} onChange={(e) => setF({ ...f, seo: { ...f.seo, title: e.target.value } })} />
            <Textarea label={`Meta description (${(f.seo.description || '').length}/170)`} maxLength={170} value={f.seo.description || ''} onChange={(e) => setF({ ...f, seo: { ...f.seo, description: e.target.value } })} />
            <Input label="Canonical URL (optional)" value={f.seo.canonical || ''} onChange={(e) => setF({ ...f, seo: { ...f.seo, canonical: e.target.value } })} />
            <div className="rounded-xl bg-soft-50 p-3 text-xs dark:bg-white/5"><p className="text-royal-700 dark:text-electric-300">{f.seo.title || f.title || 'Post title'}</p><p className="text-emerald-700">gosoft.in/blog/{f.slug || '…'}</p><p className="text-slate-500">{f.seo.description || f.excerpt || 'Meta description preview'}</p></div>
            {f.views !== undefined && <Badge>{f.views} views</Badge>}</Card>
        </div>
      </div>
    </>
  );
}
