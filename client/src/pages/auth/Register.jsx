import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { Button, Input, Select, cx } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { api, post } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useForm } from '../../lib/hooks';
import toast from 'react-hot-toast';

const BUSINESS_TYPES = [
  ['proprietorship', 'Proprietorship'], ['partnership', 'Partnership'], ['llp', 'LLP'], ['private_limited', 'Private Limited'],
  ['public_limited', 'Public Limited'], ['opc', 'One Person Company'], ['other', 'Other'],
];

function passwordHints(pw, p = {}) {
  return [
    [`${p.minLength || 8}+ characters`, pw.length >= (p.minLength || 8)],
    p.requireUppercase !== false && ['Uppercase letter', /[A-Z]/.test(pw)],
    p.requireNumber !== false && ['Number', /\d/.test(pw)],
    p.requireSymbol && ['Symbol', /[^A-Za-z0-9]/.test(pw)],
  ].filter(Boolean);
}

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: cfg } = useQuery({ queryKey: ['public-config'], queryFn: () => api('/public/config').then((r) => r.data) });
  const { data: plansRes } = useQuery({ queryKey: ['public-plans'], queryFn: () => api('/public/plans') });
  const { values, bind, set } = useForm({
    companyName: '', businessType: 'proprietorship', industry: '', gstin: '', phone: '',
    name: '', email: '', password: '', planSlug: params.get('plan') || '', inviteCode: '', acceptTerms: false,
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  const reg = cfg?.registration || {};
  const gstRule = reg.gstinRule?.[values.businessType] || reg.gstinDefault || 'optional';

  const next = (e) => {
    e.preventDefault();
    if (gstRule === 'required' && !values.gstin) return toast.error('GSTIN is required for your business type');
    setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!values.acceptTerms) return toast.error('Please accept the Terms and Privacy Policy');
    setLoading(true);
    try {
      const r = await post('/auth/register', values);
      if (r.data.requiresVerification) setSentTo(r.data.email);
      else {
        useAuth.getState().setAuth(r.data);
        toast.success('Your workspace is ready!');
        navigate('/app', { replace: true });
      }
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  if (sentTo) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-royal-600/10 text-royal-600"><MailCheck className="h-8 w-8" /></div>
        <h1 className="mt-6 text-2xl font-extrabold text-navy-900 dark:text-white">Check your inbox</h1>
        <p className="mt-3 text-slate-500">We sent a verification link to <b className="text-navy-900 dark:text-white">{sentTo}</b>. Click it to activate your workspace.</p>
        {reg.mode === 'approval' && <p className="mt-3 text-sm text-amber-600">Your workspace will also be reviewed by our team before activation.</p>}
        <Link to="/login"><Button variant="secondary" className="mt-8">Go to login</Button></Link>
      </div>
    );
  }

  const hints = passwordHints(values.password, cfg?.password);
  return (
    <>
      <Seo title="Start your free trial" path="/register" description="Create your GO SOFT workspace and start your free trial — no credit card required." />
      <div className="mb-6 flex gap-2">{[1, 2].map((s) => <div key={s} className={cx('h-1.5 flex-1 rounded-full', s <= step ? 'bg-royal-600' : 'bg-soft-200 dark:bg-white/10')} />)}</div>
      <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white">{step === 1 ? 'Tell us about your business' : 'Create your account'}</h1>
      <p className="mt-2 text-slate-500">{cfg?.trial?.enabled !== false ? `Start your free trial — no credit card required.` : 'Create your GO SOFT workspace.'}</p>

      {reg.mode === 'invite' && <p className="mt-4 rounded-xl bg-royal-600/5 p-3 text-sm text-royal-700 dark:text-electric-300">Registration is currently by invitation only.</p>}

      {step === 1 ? (
        <form onSubmit={next} className="mt-8 space-y-4">
          <Input label="Company / business name" required {...bind('companyName')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Business type" {...bind('businessType')}>{BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            <Input label="Industry" placeholder="e.g. Retail, IT services" {...bind('industry')} />
          </div>
          <Input label={`GSTIN ${gstRule === 'required' ? '' : '(optional)'}`} maxLength={15} placeholder="22AAAAA0000A1Z5" required={gstRule === 'required'}
            {...bind('gstin')} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
          <Input label={`Phone ${reg.phoneRequired ? '' : '(optional)'}`} type="tel" required={reg.phoneRequired} placeholder="+91 98765 43210" {...bind('phone')} />
          {plansRes?.data?.length > 0 && (
            <Select label="Plan to trial" {...bind('planSlug')}>
              <option value="">Recommended</option>
              {plansRes.data.map((p) => <option key={p._id} value={p.slug}>{p.name}</option>)}
            </Select>
          )}
          <Button type="submit" size="lg" className="w-full">Continue <ArrowRight className="h-4 w-4" /></Button>
        </form>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input label="Your full name" required autoComplete="name" {...bind('name')} />
          <Input label="Work email" type="email" required autoComplete="email" {...bind('email')} />
          <div>
            <Input label="Password" type="password" required autoComplete="new-password" {...bind('password')} />
            {values.password && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hints.map(([l, ok]) => <span key={l} className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-soft-100 text-slate-500 dark:bg-white/10')}>{l}</span>)}
              </div>
            )}
          </div>
          {reg.mode === 'invite' && <Input label="Invite code" required {...bind('inviteCode')} />}
          <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-royal-600" {...bind('acceptTerms', { type: 'checkbox' })} />
            <span>I agree to the <Link to="/legal/terms" target="_blank" className="font-semibold text-royal-600">Terms</Link> and <Link to="/legal/privacy-policy" target="_blank" className="font-semibold text-royal-600">Privacy Policy</Link></span>
          </label>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)} icon={ArrowLeft}>Back</Button>
            <Button type="submit" size="lg" className="flex-1" loading={loading}>Create workspace</Button>
          </div>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-royal-600 dark:text-electric-400">Log in</Link></p>
    </>
  );
}
