import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, MailWarning } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { Seo } from '../../components/Seo';
import { post } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useForm } from '../../lib/hooks';
import toast from 'react-hot-toast';

export default function Login() {
  const { values, bind } = useForm({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const navigate = useNavigate();
  const from = useLocation().state?.from;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnverified(false);
    try {
      const r = await post('/auth/login', values);
      useAuth.getState().setAuth(r.data);
      const panel = r.data.session.panel;
      navigate(from && from.startsWith(panel === 'super_admin' ? '/admin' : '/app') ? from : panel === 'super_admin' ? '/admin' : '/app', { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(true);
      else toast.error(err.message);
    } finally { setLoading(false); }
  };

  const resend = async () => {
    await post('/auth/resend-verification', { email: values.email }).catch(() => {});
    toast.success('Verification email sent');
  };

  return (
    <>
      <Seo title="Log in" path="/login" />
      <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white">Welcome back</h1>
      <p className="mt-2 text-slate-500">Log in to your GO SOFT workspace.</p>
      {unverified && (
        <div className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <MailWarning className="h-5 w-5 shrink-0" />
          <div>Please verify your email first. <button onClick={resend} className="font-semibold underline">Resend verification email</button></div>
        </div>
      )}
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input label="Email" type="email" autoComplete="email" required {...bind('email')} />
        <div className="relative">
          <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required {...bind('password')} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-9 text-slate-400" aria-label="Show password">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
        </div>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-semibold text-royal-600 dark:text-electric-400">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Log in</Button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-500">New to GO SOFT? <Link to="/register" className="font-semibold text-royal-600 dark:text-electric-400">Start your free trial</Link></p>
    </>
  );
}
