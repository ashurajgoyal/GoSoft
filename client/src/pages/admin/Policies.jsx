import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Textarea, Toggle, Tabs, PageLoader, ErrorState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { titleCase } from '../../lib/format';

const BUSINESS_TYPES = ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'opc', 'other'];
const list = (s) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

export default function Policies() {
  const { data, isLoading, error, refetch } = useApiQuery('admin-policies', '/admin/policies');
  const { data: plans } = useApiQuery('admin-plans', '/admin/plans');
  const [tab, setTab] = useState('registration');
  const [p, setP] = useState(null);
  const save = useApiMutation({ method: 'PATCH', path: '/admin/policies', invalidate: ['admin-policies', 'public-config'], success: 'Policies saved' });

  useEffect(() => { if (data?.data) setP(structuredClone(data.data)); }, [data]);
  if (isLoading || !p) return error ? <ErrorState error={error} onRetry={refetch} /> : <PageLoader />;

  const set = (section, key, value) => setP((s) => ({ ...s, [section]: { ...s[section], [key]: value } }));
  const num = (section, key) => ({ type: 'number', value: p[section]?.[key] ?? '', onChange: (e) => set(section, key, e.target.value === '' ? '' : Number(e.target.value)) });

  const submit = () => {
    const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined && o[k] !== '').map((k) => [k, o[k]]));
    const body = {
      registration: pick(p.registration, ['mode', 'emailVerificationRequired', 'phoneRequired', 'businessDetailsRequired', 'gstinDefault', 'gstinRule', 'allowedDomains', 'blockedDomains', 'maxRegistrationsPerDay', 'inviteCodes']),
      trial: pick(p.trial, ['enabled', 'defaultPlanSlug', 'days', 'oneTrialPerEmailDomain']),
      subscription: pick(p.subscription, ['graceDays', 'afterGrace', 'allowExportWhenExpired', 'expiryWarningDays']),
      password: pick(p.password, ['minLength', 'requireUppercase', 'requireNumber', 'requireSymbol']),
      session: pick(p.session, ['accessTokenMinutes', 'refreshTokenDays', 'maxFailedLogins', 'lockMinutes']),
      uploads: pick(p.uploads, ['maxFileSizeMB', 'allowedTypes']),
      dataRetention: pick(p.dataRetention, ['softDeletePurgeDays', 'auditLogRetentionDays']),
      notifications: pick(p.notifications, ['emailEnabled', 'whatsappEnabled', 'smsEnabled']),
      maintenance: pick(p.maintenance, ['enabled', 'message']),
    };
    save.mutate({ body });
  };

  const tabs = [['registration', 'Registration'], ['trial', 'Trial & subscription'], ['security', 'Security & sessions'], ['data', 'Uploads & data'], ['notifications', 'Notifications'], ['maintenance', 'Maintenance']];

  return (
    <>
      <PageHeader title="Platform policies" description="Rules enforced server-side for every company on GO SOFT." actions={<Button icon={Save} loading={save.isPending} onClick={submit}>Save changes</Button>} />
      <Tabs tabs={tabs.map(([value, label]) => ({ value, label }))} value={tab} onChange={setTab} />
      <Card className="p-6">
        {tab === 'registration' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Select label="Registration mode" value={p.registration.mode} onChange={(e) => set('registration', 'mode', e.target.value)}>
                <option value="open">Open — anyone can register</option><option value="approval">Admin approval required</option><option value="invite">Invitation code only</option>
              </Select>
              {p.registration.mode === 'invite' && <Textarea label="Invite codes (one per line)" value={(p.registration.inviteCodes || []).join('\n')} onChange={(e) => set('registration', 'inviteCodes', list(e.target.value))} />}
              <Input label="Max registrations per day" {...num('registration', 'maxRegistrationsPerDay')} />
              <Textarea label="Allowed email domains (empty = all)" value={(p.registration.allowedDomains || []).join('\n')} onChange={(e) => set('registration', 'allowedDomains', list(e.target.value))} />
              <Textarea label="Blocked email domains" value={(p.registration.blockedDomains || []).join('\n')} onChange={(e) => set('registration', 'blockedDomains', list(e.target.value))} />
            </div>
            <div>
              <Toggle label="Email verification required" checked={p.registration.emailVerificationRequired} onChange={(v) => set('registration', 'emailVerificationRequired', v)} />
              <Toggle label="Phone number required" checked={p.registration.phoneRequired} onChange={(v) => set('registration', 'phoneRequired', v)} />
              <Toggle label="Business details mandatory" checked={p.registration.businessDetailsRequired} onChange={(v) => set('registration', 'businessDetailsRequired', v)} />
              <h3 className="mb-2 mt-5 text-sm font-semibold">GSTIN requirement by business type</h3>
              <Select label="Default" value={p.registration.gstinDefault} onChange={(e) => set('registration', 'gstinDefault', e.target.value)}><option value="optional">Optional</option><option value="required">Required</option></Select>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {BUSINESS_TYPES.map((t) => (
                  <Select key={t} label={titleCase(t)} value={p.registration.gstinRule?.[t] || ''} onChange={(e) => {
                    const rule = { ...(p.registration.gstinRule || {}) };
                    if (e.target.value) rule[t] = e.target.value; else delete rule[t];
                    set('registration', 'gstinRule', rule);
                  }}><option value="">Use default</option><option value="optional">Optional</option><option value="required">Required</option></Select>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'trial' && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold">Free trial</h3>
              <Toggle label="Free trial enabled" checked={p.trial.enabled} onChange={(v) => set('trial', 'enabled', v)} />
              <Toggle label="One trial per organisation email domain" description="Public domains like gmail.com are exempt" checked={p.trial.oneTrialPerEmailDomain} onChange={(v) => set('trial', 'oneTrialPerEmailDomain', v)} />
              <Select label="Default trial plan" value={p.trial.defaultPlanSlug} onChange={(e) => set('trial', 'defaultPlanSlug', e.target.value)}>
                {plans?.data?.filter((x) => !x.isArchived).map((x) => <option key={x._id} value={x.slug}>{x.name}</option>)}
              </Select>
              <Input label="Fallback trial days" hint="Used when a plan has no trial length" {...num('trial', 'days')} />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Expiry & grace</h3>
              <Input label="Grace period (days)" hint="Read-only access, renewal and export during grace" {...num('subscription', 'graceDays')} />
              <Select label="After grace period" value={p.subscription.afterGrace} onChange={(e) => set('subscription', 'afterGrace', e.target.value)}>
                <option value="read_only">Stay read-only</option><option value="blocked">Block until renewed</option>
              </Select>
              <Input label="Show expiry warning (days before)" {...num('subscription', 'expiryWarningDays')} />
              <Toggle label="Allow data export while expired" checked={p.subscription.allowExportWhenExpired} onChange={(v) => set('subscription', 'allowExportWhenExpired', v)} />
              <p className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">Company data is never deleted automatically when a subscription expires.</p>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="mb-2 font-semibold">Password policy</h3>
              <Input label="Minimum length" {...num('password', 'minLength')} />
              <Toggle label="Require uppercase letter" checked={p.password.requireUppercase} onChange={(v) => set('password', 'requireUppercase', v)} />
              <Toggle label="Require number" checked={p.password.requireNumber} onChange={(v) => set('password', 'requireNumber', v)} />
              <Toggle label="Require symbol" checked={p.password.requireSymbol} onChange={(v) => set('password', 'requireSymbol', v)} />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Sessions & lockout</h3>
              <Input label="Access token lifetime (minutes)" {...num('session', 'accessTokenMinutes')} />
              <Input label="Refresh session lifetime (days)" {...num('session', 'refreshTokenDays')} />
              <Input label="Failed logins before lockout" {...num('session', 'maxFailedLogins')} />
              <Input label="Lockout duration (minutes)" {...num('session', 'lockMinutes')} />
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold">File uploads</h3>
              <Input label="Max file size (MB)" {...num('uploads', 'maxFileSizeMB')} />
              <Textarea label="Allowed MIME types" value={(p.uploads.allowedTypes || []).join('\n')} onChange={(e) => set('uploads', 'allowedTypes', list(e.target.value))} />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Data retention</h3>
              <Input label="Purge soft-deleted records after (days)" {...num('dataRetention', 'softDeletePurgeDays')} />
              <Input label="Keep audit logs for (days)" {...num('dataRetention', 'auditLogRetentionDays')} />
            </div>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="max-w-lg">
            <Toggle label="Email notifications" checked={p.notifications.emailEnabled} onChange={(v) => set('notifications', 'emailEnabled', v)} />
            <Toggle label="WhatsApp notifications" description="Requires a WhatsApp Business provider (Phase 5)" checked={p.notifications.whatsappEnabled} onChange={(v) => set('notifications', 'whatsappEnabled', v)} />
            <Toggle label="SMS notifications" description="Requires an SMS provider (Phase 5)" checked={p.notifications.smsEnabled} onChange={(v) => set('notifications', 'smsEnabled', v)} />
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="max-w-xl space-y-4">
            <Toggle label="Maintenance mode" description="Company users see the message below and cannot use their workspace. Super Admins keep access." checked={p.maintenance.enabled} onChange={(v) => set('maintenance', 'enabled', v)} />
            <Textarea label="Maintenance message" value={p.maintenance.message} onChange={(e) => set('maintenance', 'message', e.target.value)} />
          </div>
        )}
      </Card>
    </>
  );
}
