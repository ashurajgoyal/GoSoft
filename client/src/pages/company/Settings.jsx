import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, PageLoader, ErrorState } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { refreshSession } from '../../lib/api';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep'];

export default function Settings() {
  const can = useCan();
  const editable = can('core.company.edit');
  const { data, isLoading, error, refetch } = useApiQuery('company-settings', '/company/settings');
  const [f, setF] = useState(null);
  const save = useApiMutation({ method: 'PATCH', path: '/company/settings', invalidate: ['company-settings', 'company-dashboard'], success: 'Settings saved', onSuccess: () => refreshSession().catch(() => {}) });
  useEffect(() => { if (data?.data) setF({ ...data.data, address: data.data.address || {}, settings: data.data.settings || {} }); }, [data]);
  if (isLoading || !f) return error ? <ErrorState error={error} onRetry={refetch} /> : <PageLoader />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setA = (k) => (e) => setF({ ...f, address: { ...f.address, [k]: e.target.value } });
  const setS = (k, n) => (e) => setF({ ...f, settings: { ...f.settings, [k]: n ? Number(e.target.value) : e.target.value } });
  const submit = (e) => {
    e.preventDefault();
    const { line1, line2, city, state, pincode } = f.address;
    save.mutate({ body: {
      name: f.name, phone: f.phone || undefined, industry: f.industry || '', businessType: f.businessType, gstin: f.gstin || undefined, pan: f.pan || '',
      address: { line1, line2, city, state, pincode, stateCode: f.gstin ? f.gstin.slice(0, 2) : undefined },
      settings: { financialYearStartMonth: f.settings.financialYearStartMonth, dateFormat: f.settings.dateFormat, timezone: f.settings.timezone },
    } });
  };

  return (
    <form onSubmit={submit}>
      <PageHeader title="Company settings" description="Your business profile appears on invoices, payslips and documents." actions={editable && <Button type="submit" icon={Save} loading={save.isPending}>Save changes</Button>} />
      <fieldset disabled={!editable} className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-navy-900 dark:text-white">Business profile</h2>
          <Input label="Company name" value={f.name} onChange={set('name')} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Business type" value={f.businessType} onChange={set('businessType')}>
              {[['proprietorship', 'Proprietorship'], ['partnership', 'Partnership'], ['llp', 'LLP'], ['private_limited', 'Private Limited'], ['public_limited', 'Public Limited'], ['opc', 'OPC'], ['other', 'Other']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Input label="Industry" value={f.industry || ''} onChange={set('industry')} />
            <Input label="GSTIN" maxLength={15} value={f.gstin || ''} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
            <Input label="PAN" maxLength={10} value={f.pan || ''} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} />
            <Input label="Phone" value={f.phone || ''} onChange={set('phone')} />
            <Input label="Account email" value={f.email} disabled />
          </div>
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="font-bold text-navy-900 dark:text-white">Registered address</h2>
          <Input label="Address line 1" value={f.address.line1 || ''} onChange={setA('line1')} />
          <Input label="Address line 2" value={f.address.line2 || ''} onChange={setA('line2')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City" value={f.address.city || ''} onChange={setA('city')} />
            <Select label="State" value={f.address.state || ''} onChange={setA('state')}><option value="">Select</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Select>
            <Input label="PIN code" maxLength={6} value={f.address.pincode || ''} onChange={setA('pincode')} />
          </div>
        </Card>
        <Card className="space-y-4 p-6 lg:col-span-2">
          <h2 className="font-bold text-navy-900 dark:text-white">Preferences</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Financial year starts" value={f.settings.financialYearStartMonth || 4} onChange={setS('financialYearStartMonth', true)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
            <Select label="Date format" value={f.settings.dateFormat || 'DD/MM/YYYY'} onChange={setS('dateFormat')}>{['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((d) => <option key={d}>{d}</option>)}</Select>
            <Select label="Time zone" value={f.settings.timezone || 'Asia/Kolkata'} onChange={setS('timezone')}>{['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Toronto'].map((t) => <option key={t}>{t}</option>)}</Select>
          </div>
        </Card>
      </fieldset>
    </form>
  );
}
