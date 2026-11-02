import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { post } from '../../lib/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await post('/auth/forgot-password', { email }); setSent(true); } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  if (sent) return (
    <div className="text-center">
      <MailCheck className="mx-auto h-12 w-12 text-royal-600" />
      <h1 className="mt-5 text-2xl font-extrabold text-navy-900 dark:text-white">Check your email</h1>
      <p className="mt-3 text-slate-500">If an account exists for <b>{email}</b>, you will receive a password reset link shortly. It expires in 30 minutes.</p>
      <Link to="/login"><Button variant="secondary" className="mt-8">Back to login</Button></Link>
    </div>
  );
  return (
    <>
      <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white">Forgot your password?</h1>
      <p className="mt-2 text-slate-500">Enter your email and we will send you a reset link.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
      </form>
      <p className="mt-8 text-center text-sm"><Link to="/login" className="font-semibold text-royal-600 dark:text-electric-400">Back to login</Link></p>
    </>
  );
}
