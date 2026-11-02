import { useEffect, useState } from 'react';
import { Save, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, PageHeader, Button, Input, Textarea, Toggle, Tabs, PageLoader, ErrorState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';

function ListEditor({ items = [], onChange, fields, blank, title }) {
  const set = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i, d) => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-soft-200 p-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between"><b className="text-sm">{title} {i + 1}</b><div className="flex gap-1">
            {i > 0 && <Button size="sm" variant="ghost" icon={ChevronUp} onClick={() => move(i, -1)} aria-label="Up" />}{i < items.length - 1 && <Button size="sm" variant="ghost" icon={ChevronDown} onClick={() => move(i, 1)} aria-label="Down" />}
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" /></div></div>
          <div className="grid gap-3 sm:grid-cols-2">{fields.map(([k, l, type]) => (type === 'textarea'
            ? <Textarea key={k} className="sm:col-span-2" label={l} value={it[k] || ''} onChange={(e) => set(i, k, e.target.value)} />
            : type === 'lines' ? <Textarea key={k} className="sm:col-span-2" label={`${l} (one per line)`} value={(it[k] || []).join('\n')} onChange={(e) => set(i, k, e.target.value.split('\n'))} />
              : <Input key={k} label={l} value={it[k] || ''} onChange={(e) => set(i, k, e.target.value)} />))}</div>
        </div>
      ))}
      <Button variant="secondary" icon={Plus} onClick={() => onChange([...items, { ...blank }])}>Add {title.toLowerCase()}</Button>
    </div>
  );
}

export default function Website() {
  const { data, isLoading, error, refetch } = useApiQuery('admin-site', '/admin/site');
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('home');
  const save = useApiMutation({ method: 'PATCH', path: '/admin/site', invalidate: ['admin-site', 'public-site'], success: 'Website updated — changes are live' });
  useEffect(() => { if (data) setS(data.data); }, [data]);
  if (isLoading || !s) return error ? <ErrorState error={error} onRetry={refetch} /> : <PageLoader />;
  const sec = (k) => s[k] || {};
  const bind = (k, f) => ({ value: sec(k)[f] || '', onChange: (e) => setS({ ...s, [k]: { ...sec(k), [f]: e.target.value } }) });
  const submit = () => {
    const { brand, hero, announcement, contact, social, testimonials, faqs, features, landingPages, footer, seo, sitemap, redirects } = s;
    save.mutate({ body: { brand, hero, announcement, contact, social, testimonials, faqs, features, landingPages: (landingPages || []).map((p) => ({ ...p, points: (p.points || []).filter(Boolean) })), footer, seo, sitemap, redirects } });
  };

  return (
    <>
      <PageHeader title="Website CMS" description="Edit every piece of public marketing content — no deploy needed." actions={<><a href="/" target="_blank" rel="noreferrer"><Button variant="secondary">View site</Button></a><Button icon={Save} loading={save.isPending} onClick={submit}>Publish changes</Button></>} />
      <Tabs value={tab} onChange={setTab} tabs={[['home', 'Homepage'], ['contact', 'Contact & social'], ['testimonials', 'Testimonials'], ['faqs', 'FAQs'], ['landing', 'Landing pages'], ['seo', 'SEO, sitemap & redirects'], ['brand', 'Logo & footer']].map(([value, label]) => ({ value, label }))} />
      <Card className="p-6">
        {tab === 'home' && <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4"><h3 className="font-bold">Hero section</h3><Input label="Badge text" {...bind('hero', 'badge')} /><Input label="Headline" {...bind('hero', 'headline')} /><Textarea label="Sub-headline" {...bind('hero', 'subheadline')} /></div>
          <div className="space-y-4"><h3 className="font-bold">Announcement banner</h3><Toggle label="Show banner on every page" checked={!!sec('announcement').enabled} onChange={(v) => setS({ ...s, announcement: { ...sec('announcement'), enabled: v } })} />
            <Input label="Text" {...bind('announcement', 'text')} /><Input label="Link (optional)" {...bind('announcement', 'link')} />
            <h3 className="pt-4 font-bold">Homepage features</h3><ListEditor title="Feature" items={s.features} onChange={(v) => setS({ ...s, features: v })} blank={{ title: '', description: '' }} fields={[['title', 'Title'], ['description', 'Description', 'textarea']]} /></div></div>}
        {tab === 'contact' && <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone" {...bind('contact', 'phone')} /><Input label="WhatsApp number (with country code, e.g. 919799289697)" {...bind('contact', 'whatsapp')} /><Input label="Email" {...bind('contact', 'email')} /><Input label="Business hours" {...bind('contact', 'hours')} />
          <Textarea className="sm:col-span-2" label="Address" {...bind('contact', 'address')} />
          {['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'].map((k) => <Input key={k} label={`${k[0].toUpperCase() + k.slice(1)} URL`} {...bind('social', k)} />)}</div>}
        {tab === 'testimonials' && <><p className="mb-4 text-sm text-slate-500">Publish only genuine customer feedback with their permission.</p><ListEditor title="Testimonial" items={s.testimonials} onChange={(v) => setS({ ...s, testimonials: v })} blank={{ name: '', role: '', company: '', quote: '' }} fields={[['name', 'Customer name'], ['role', 'Role'], ['company', 'Company'], ['photoUrl', 'Photo URL'], ['quote', 'Quote', 'textarea']]} /></>}
        {tab === 'faqs' && <ListEditor title="FAQ" items={s.faqs} onChange={(v) => setS({ ...s, faqs: v })} blank={{ q: '', a: '' }} fields={[['q', 'Question'], ['a', 'Answer', 'textarea']]} />}
        {tab === 'landing' && <ListEditor title="Landing page" items={s.landingPages} onChange={(v) => setS({ ...s, landingPages: v })} blank={{ slug: '', name: '', short: '', title: '', h1: '', intro: '', points: [] }}
          fields={[['slug', 'URL slug (/software/…)'], ['name', 'Menu name'], ['short', 'Short tagline'], ['title', 'SEO title'], ['h1', 'Page headline'], ['seoDescription', 'Meta description'], ['intro', 'Intro paragraph', 'textarea'], ['points', 'Feature bullets', 'lines']]} />}
        {tab === 'seo' && <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4"><h3 className="font-bold">Defaults</h3><Input label="Default title" {...bind('seo', 'defaultTitle')} /><Textarea label="Default meta description" {...bind('seo', 'defaultDescription')} /><Input label="Open Graph image URL" {...bind('seo', 'ogImage')} />
            <Input label="Google Search Console verification code" {...bind('seo', 'googleSiteVerification')} hint="Content of the google-site-verification meta tag" />
            <h3 className="pt-2 font-bold">Sitemap</h3><Toggle label="Include blog posts" checked={sec('sitemap').includeBlog !== false} onChange={(v) => setS({ ...s, sitemap: { ...sec('sitemap'), includeBlog: v } })} />
            <Textarea label="Extra URLs (one per line)" value={(sec('sitemap').extraUrls || []).join('\n')} onChange={(e) => setS({ ...s, sitemap: { ...sec('sitemap'), extraUrls: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) } })} /></div>
          <div><h3 className="mb-3 font-bold">301 redirects</h3><ListEditor title="Redirect" items={s.redirects} onChange={(v) => setS({ ...s, redirects: v })} blank={{ from: '/', to: '/', permanent: true }} fields={[['from', 'From path (e.g. /old-page)'], ['to', 'To path or URL']]} /></div></div>}
        {tab === 'brand' && <div className="grid gap-4 sm:grid-cols-2"><Input label="Logo URL (optional — default logo used if empty)" {...bind('brand', 'logoUrl')} /><Input label="Favicon URL" {...bind('brand', 'faviconUrl')} /><Input label="Tagline" {...bind('brand', 'tagline')} />
          <Textarea className="sm:col-span-2" label="Footer about text" {...bind('footer', 'about')} /><Input label="Copyright line" {...bind('footer', 'copyright')} /></div>}
      </Card>
    </>
  );
}
