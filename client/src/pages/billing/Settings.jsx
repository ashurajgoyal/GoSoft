import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card, PageHeader, Button, Input, Textarea, PageLoader } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';

export default function BillingSettings() {
  const can = useCan();
  const { data, isLoading } = useApiQuery('billing-settings', '/company/billing/settings');
  const [f, setF] = useState(null);
  const save = useApiMutation({ method: 'PATCH', path: '/company/billing/settings', invalidate: ['billing-settings'], success: 'Billing settings saved' });
  useEffect(() => { if (data) setF(data.data); }, [data]);
  if (isLoading || !f) return <PageLoader />;
  const b = (k) => ({ value: f[k] ?? '', onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  return (
    <>
      <PageHeader title="Billing settings" description="Numbering, payment details and default terms printed on invoices."
        actions={can('billing.settings.configure') && <Button icon={Save} loading={save.isPending} onClick={() => save.mutate({ body: { ...f, defaultDueDays: Number(f.defaultDueDays) } })}>Save</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid gap-4 p-6 sm:grid-cols-2"><h2 className="font-bold sm:col-span-2">Number prefixes</h2>
          <Input label="Tax invoice" {...b('invoicePrefix')} /><Input label="Proforma" {...b('proformaPrefix')} /><Input label="Credit note" {...b('creditNotePrefix')} /><Input label="Debit note" {...b('debitNotePrefix')} /><Input label="Receipt" {...b('receiptPrefix')} />
          <Input label="Default due days" type="number" {...b('defaultDueDays')} />
          <p className="text-xs text-slate-500 sm:col-span-2">Numbers look like INV/2026-27/0001 and restart every financial year.</p></Card>
        <Card className="space-y-4 p-6"><h2 className="font-bold">Payment & signature</h2>
          <Textarea label="Bank details" placeholder={'Bank: …\nA/c: …\nIFSC: …'} {...b('bankDetails')} /><Input label="UPI ID" {...b('upiId')} /><Input label="Authorised signatory" {...b('signatory')} /></Card>
        <Card className="p-6 lg:col-span-2"><Textarea label="Default terms & conditions" {...b('defaultTerms')} /></Card>
      </div>
    </>
  );
}
