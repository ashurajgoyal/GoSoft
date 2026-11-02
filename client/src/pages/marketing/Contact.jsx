import { useState } from 'react';
import { Mail, MessageSquare, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { Button, Input, Select, Textarea, Card } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { post } from '../../lib/api';
import { useForm } from '../../lib/hooks';
import toast from 'react-hot-toast';
import { Phone, MapPin } from 'lucide-react';
import { useSite } from '../../lib/site';

export default function Contact({ demo = false }) {
  const { values, bind, setValues } = useForm({ name: '', email: '', phone: '', company: '', employees: '', message: '', website: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const { contact } = useSite();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await post('/public/leads', { ...values, type: demo ? 'demo' : 'contact', source: demo ? 'book-demo' : 'contact-page' });
      setDone(r.data.message);
      setValues({ name: '', email: '', phone: '', company: '', employees: '', message: '', website: '' });
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <>
      <Seo title={demo ? 'Book a Demo' : 'Contact Us'} path={demo ? '/book-demo' : '/contact'} description="Talk to the GO SOFT team about billing, HRMS, payroll and task management for your business." />
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-royal-600 dark:text-electric-400">{demo ? 'Book a demo' : 'Contact'}</p>
          <h1 className="mt-3 text-4xl font-extrabold text-navy-900 dark:text-white">{demo ? 'See GO SOFT in action' : "Let's talk about your business"}</h1>
          <p className="mt-4 text-slate-500">{demo ? 'Get a personalised 30-minute walkthrough tailored to how your team works.' : 'Questions about plans, migration or custom requirements? Our team replies within one business day.'}</p>
          <div className="mt-8 space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm dark:bg-navy-900">
            <p className="flex gap-2"><Phone className="h-4 w-4 text-royal-600" /><a href={`tel:${contact.phone}`} className="font-semibold">{contact.phone}</a></p>
            <p className="flex gap-2"><Mail className="h-4 w-4 text-royal-600" /><a href={`mailto:${contact.email}`}>{contact.email}</a></p>
            <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-royal-600" />{contact.address}</p>
            {contact.hours && <p className="text-slate-500">{contact.hours}</p>}
          </div>
          <div className="mt-10 space-y-5">
            {[[CalendarCheck, 'Personalised walkthrough', 'We show the modules that matter to you.'], [MessageSquare, 'Migration support', 'Help moving from spreadsheets or other software.'], [Mail, 'Fast response', 'A real person gets back to you, usually the same day.']].map(([Icon, t, d]) => (
              <div key={t} className="flex gap-4">
                <div className="rounded-xl bg-royal-600/10 p-3 text-royal-600 dark:text-electric-400"><Icon className="h-5 w-5" /></div>
                <div><p className="font-semibold text-navy-900 dark:text-white">{t}</p><p className="text-sm text-slate-500">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
        <Card className="p-7">
          {done ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h2 className="mt-4 text-xl font-bold text-navy-900 dark:text-white">Request received</h2>
              <p className="mt-2 text-slate-500">{done}</p>
              <Button variant="secondary" className="mt-6" onClick={() => setDone(null)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full name" required {...bind('name')} />
                <Input label="Work email" type="email" required {...bind('email')} />
                <Input label="Phone" type="tel" {...bind('phone')} />
                <Input label="Company" {...bind('company')} />
              </div>
              <Select label="Team size" {...bind('employees')}>
                <option value="">Select</option>
                {['1-10', '11-50', '51-200', '201-500', '500+'].map((s) => <option key={s}>{s}</option>)}
              </Select>
              <Textarea label={demo ? 'What would you like to see?' : 'Message'} {...bind('message')} />
              <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" {...bind('website')} />
              <Button type="submit" loading={loading} className="w-full" size="lg">{demo ? 'Request demo' : 'Send message'}</Button>
              <p className="text-center text-xs text-slate-500">By submitting you agree to our Privacy Policy.</p>
            </form>
          )}
        </Card>
      </section>
    </>
  );
}
