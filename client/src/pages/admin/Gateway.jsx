import { useEffect, useState } from 'react';
import { Save, PlugZap, ShieldCheck, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, PageHeader, Button, Input, Select, Toggle, Badge, PageLoader, ErrorState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { dateTime } from '../../lib/format';

function CredBox({ mode, creds, value, onChange }) {
  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between"><h2 className="font-bold capitalize">{mode} credentials</h2>{creds.secretConfigured ? <Badge color="green"><ShieldCheck className="h-3 w-3" />Secret saved</Badge> : <Badge color="amber">Not configured</Badge>}</div>
      <Input label="App ID (x-client-id)" value={value.appId} onChange={(e) => onChange({ ...value, appId: e.target.value.trim() })} placeholder={mode === 'sandbox' ? 'TEST…' : 'Your live App ID'} />
      <Input label="Secret Key (x-client-secret)" type="password" autoComplete="new-password" value={value.secretKey} onChange={(e) => onChange({ ...value, secretKey: e.target.value.trim() })}
        placeholder={creds.secretConfigured ? '•••••••• (leave blank to keep current)' : 'Paste secret key'} hint="Encrypted with AES-256-GCM before storage. It is never shown again." />
      {creds.updatedAt && <p className="text-xs text-slate-500">Last updated {dateTime(creds.updatedAt)}</p>}
    </Card>
  );
}

export default function Gateway() {
  const { data, isLoading, error, refetch } = useApiQuery('admin-gateway', '/admin/gateway');
  const [f, setF] = useState(null);
  const save = useApiMutation({ method: 'PATCH', path: '/admin/gateway', invalidate: ['admin-gateway'], success: 'Gateway settings saved' });
  const test = useApiMutation({ path: '/admin/gateway/test', invalidate: ['admin-gateway'], onSuccess: (r) => (r.data.ok ? toast.success(r.data.message) : toast.error(r.data.message)) });
  useEffect(() => { if (data) setF({ ...data.data, sandbox: { appId: data.data.sandbox.appId, secretKey: '' }, production: { appId: data.data.production.appId, secretKey: '' } }); }, [data]);
  if (isLoading || !f) return error ? <ErrorState error={error} onRetry={refetch} /> : <PageLoader />;
  const g = data.data;
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success('Copied'); };
  const submit = (extra = {}) => save.mutate({ body: { mode: f.mode, gstRate: Number(f.gstRate), seller: f.seller,
    sandbox: { appId: f.sandbox.appId, ...(f.sandbox.secretKey ? { secretKey: f.sandbox.secretKey } : {}) },
    production: { appId: f.production.appId, ...(f.production.secretKey ? { secretKey: f.production.secretKey } : {}) }, ...extra } });

  return (
    <>
      <PageHeader title="Payment gateway — Cashfree" description="Manage Cashfree API keys, sandbox/live mode and invoice details. Changes apply immediately to every checkout."
        actions={<><Button variant="secondary" icon={PlugZap} loading={test.isPending} onClick={() => test.mutate()}>Test connection</Button><Button icon={Save} loading={save.isPending} onClick={() => submit()}>Save</Button></>} />
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <Toggle label={g.enabled ? 'Online payments are LIVE for customers' : 'Online payments are OFF'} description="Customers see Pay buttons only when enabled." checked={g.enabled} onChange={(v) => submit({ enabled: v })} />
        </div>
        <div className="flex items-center gap-3"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="sandbox">Sandbox (test money)</option><option value="production">Production (real money)</option></Select>
          <Badge color={g.mode === 'production' ? 'red' : 'amber'}>Active: {g.mode}</Badge></div>
      </Card>
      {g.lastTestedAt && <p className="mb-4 text-sm text-slate-500">Last test {dateTime(g.lastTestedAt)}: <b>{g.lastTestResult}</b></p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <CredBox mode="sandbox" creds={g.sandbox} value={f.sandbox} onChange={(v) => setF({ ...f, sandbox: v })} />
        <CredBox mode="production" creds={g.production} value={f.production} onChange={(v) => setF({ ...f, production: v })} />
        <Card className="space-y-3 p-6"><h2 className="font-bold">Webhook setup (Cashfree dashboard → Developers → Webhooks)</h2>
          {[['Webhook URL', g.webhookUrl], ['Return URL (automatic)', g.returnUrl], ['API version', g.apiVersion]].map(([l, v]) => (
            <div key={l}><span className="label">{l}</span><div className="flex gap-2"><input readOnly className="input font-mono text-xs" value={v} /><Button variant="secondary" icon={Copy} onClick={() => copy(v)} aria-label="Copy" /></div></div>))}
          <p className="text-xs text-slate-500">Subscribe to <b>Payment Success</b>, <b>Payment Failed</b> and <b>Payment User Dropped</b> events. The webhook URL must be public HTTPS. Signatures are verified with your secret key, and every order is re-confirmed with the Cashfree API before a plan is activated.</p></Card>
        <Card className="grid gap-4 p-6 sm:grid-cols-2"><h2 className="font-bold sm:col-span-2">Invoice seller details & GST</h2>
          {[['legalName', 'Legal name'], ['gstin', 'GSTIN'], ['stateCode', 'State code (e.g. 08)'], ['phone', 'Phone'], ['email', 'Email']].map(([k, l]) => <Input key={k} label={l} value={f.seller?.[k] || ''} onChange={(e) => setF({ ...f, seller: { ...f.seller, [k]: e.target.value } })} />)}
          <Input label="GST rate on subscriptions (%)" type="number" value={f.gstRate} onChange={(e) => setF({ ...f, gstRate: e.target.value })} />
          <Input className="sm:col-span-2" label="Address" value={f.seller?.address || ''} onChange={(e) => setF({ ...f, seller: { ...f.seller, address: e.target.value } })} /></Card>
      </div>
    </>
  );
}
