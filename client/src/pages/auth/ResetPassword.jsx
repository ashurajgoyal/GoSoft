import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../../components/ui';
import { post } from '../../lib/api';
import toast from 'react-hot-toast';

export default function ResetPassword({ invite = false }) {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const r = await post('/auth/reset-password', { token, password });
      toast.success(r.data.message);
      navigate('/login', { replace: true });
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  if (!token) return <p className="text-center text-slate-500">This link is invalid. <Link to="/forgot-password" className="font-semibold text-royal-600">Request a new one</Link>.</p>;
  return (
    <>
      <h1 className="text-3xl font-extrabold text-navy-900 dark:text-white">{invite ? 'Join your team on GO SOFT' : 'Set a new password'}</h1>
      <p className="mt-2 text-slate-500">{invite ? 'Create a password to activate your account.' : 'Choose a strong password you have not used before.'}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Input label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters with an uppercase letter and a number." />
        <Input label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" size="lg" className="w-full" loading={loading}>{invite ? 'Activate account' : 'Update password'}</Button>
      </form>
    </>
  );
}
