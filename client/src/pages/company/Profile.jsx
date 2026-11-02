import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { Card, PageHeader, Button, Input } from '../../components/ui';
import { useAuth } from '../../store/auth';
import { api, post, refreshSession } from '../../lib/api';
import { dateTime } from '../../lib/format';
import toast from 'react-hot-toast';

export default function Profile() {
  const session = useAuth((s) => s.session);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState(session.user.name);
  const [phone, setPhone] = useState(session.user.phone || '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try { await api('/auth/me', { method: 'PATCH', body: { name, ...(phone ? { phone } : {}) } }); await refreshSession(); toast.success('Profile updated'); }
    catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
    setBusy('pw');
    try {
      const r = await post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      useAuth.getState().setAuth({ accessToken: r.data.accessToken });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };
  const logoutAll = async () => {
    await post('/auth/logout-all').catch(() => {});
    useAuth.getState().clear();
    qc.clear();
    navigate('/login');
  };

  return (
    <>
      <PageHeader title="My profile" description={`Last login ${dateTime(session.user.lastLoginAt)}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-bold text-navy-900 dark:text-white">Personal details</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" value={session.user.email} disabled />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={busy === 'profile'}>Save</Button>
          </form>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 font-bold text-navy-900 dark:text-white">Change password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            <Button type="submit" loading={busy === 'pw'}>Update password</Button>
          </form>
        </Card>
        <Card className="flex items-center justify-between gap-4 p-6 lg:col-span-2">
          <div><h2 className="font-bold text-navy-900 dark:text-white">Sign out everywhere</h2><p className="text-sm text-slate-500">Ends all sessions on every device, including this one.</p></div>
          <Button variant="danger" icon={LogOut} onClick={logoutAll}>Sign out all devices</Button>
        </Card>
      </div>
    </>
  );
}
