import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Save } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Textarea, Toggle, PageLoader } from '../../components/ui';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/hooks';
import { computeInvoice } from '../../lib/gst';
import { inr, titleCase } from '../../lib/format';
import { toDateInput } from '../../lib/obj';
import { STATE_OPTIONS } from './Masters';
import { useAuth } from '../../store/auth';

const blank = () => ({ product: '', description: '', hsnSac: '', unit: 'NOS', quantity: 1, rate: 0, discountPercent: 0, taxRate: 18 });

export default function InvoiceEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useAuth((s) => s.session);
  const { data: customers } = useQuery({ queryKey: ['ref', '/company/billing/customers'], queryFn: () => api('/company/billing/customers', { query: { limit: 500 } }) });
  const { data: products } = useQuery({ queryKey: ['ref', '/company/billing/products'], queryFn: () => api('/company/billing/products', { query: { limit: 500 } }) });
  const { data: existing, isLoading } = useQuery({ queryKey: ['invoice', id], queryFn: () => api(`/company/billing/invoices/${id}`), enabled: !!id });
  const { data: refInv } = useQuery({ queryKey: ['invoice', params.get('ref')], queryFn: () => api(`/company/billing/invoices/${params.get('ref')}`), enabled: !!params.get('ref') && !id });

  const [f, setF] = useState({ type: params.get('type') || 'invoice', customer: params.get('customer') || '', date: toDateInput(new Date()), dueDate: '', placeOfSupply: '', taxInclusive: false, discountTotal: 0, notes: '', terms: '', status: 'issued', items: [blank()], referenceInvoice: params.get('ref') || '' });
  useEffect(() => {
    const inv = existing?.data?.invoice;
    if (inv) setF({ ...inv, customer: inv.customer, date: toDateInput(inv.date), dueDate: toDateInput(inv.dueDate), items: inv.items.map((it) => ({ ...it, product: it.product || '' })), referenceInvoice: inv.referenceInvoice || '' });
  }, [existing]);
  useEffect(() => {
    const inv = refInv?.data?.invoice;
    if (inv) setF((s) => ({ ...s, customer: inv.customer, placeOfSupply: inv.placeOfSupply, taxInclusive: inv.taxInclusive, items: inv.items.map((it) => ({ ...it, product: it.product || '' })), notes: `Against invoice ${inv.number}` }));
  }, [refInv]);

  const customer = customers?.data?.find((c) => c._id === f.customer);
  const supplierState = session.company?.gstin?.slice(0, 2);
  const pos = f.placeOfSupply || customer?.stateCode || customer?.gstin?.slice(0, 2) || supplierState;
  const calc = useMemo(() => computeInvoice(f.items, { supplierStateCode: supplierState, placeOfSupply: pos, taxInclusive: f.taxInclusive, discountTotal: f.discountTotal }), [f, pos, supplierState]);

  const setItem = (i, patch) => setF((s) => ({ ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const pickProduct = (i, pid) => {
    const p = products?.data?.find((x) => x._id === pid);
    setItem(i, p ? { product: p._id, description: p.name, hsnSac: p.hsnSac, unit: p.unit, rate: p.rate, taxRate: p.taxRate } : { product: '' });
    if (p?.taxInclusive && i === 0) setF((s) => ({ ...s, taxInclusive: true }));
  };

  const save = useApiMutation({ method: id ? 'PATCH' : 'POST', path: id ? `/company/billing/invoices/${id}` : '/company/billing/invoices', invalidate: ['invoices'], success: 'Saved',
    onSuccess: (r) => navigate(`/app/billing/invoices/${r.data._id}`, { replace: true }) });
  const submit = (status) => save.mutate({ body: {
    type: f.type, customer: f.customer, date: f.date, dueDate: f.dueDate || null, placeOfSupply: pos, taxInclusive: f.taxInclusive, discountTotal: Number(f.discountTotal) || 0,
    notes: f.notes || undefined, terms: f.terms || undefined, status, referenceInvoice: f.referenceInvoice || undefined,
    items: f.items.filter((it) => it.description).map(({ product, description, hsnSac, unit, quantity, rate, discountPercent, taxRate }) => ({ product: product || undefined, description, hsnSac, unit, quantity: Number(quantity), rate: Number(rate), discountPercent: Number(discountPercent) || 0, taxRate: Number(taxRate) })),
  } });

  if (id && isLoading) return <PageLoader />;
  return (
    <>
      <PageHeader title={`${id ? 'Edit' : 'New'} ${titleCase(f.type)}`} description={supplierState ? `Supplier state ${supplierState} · Place of supply ${pos || '—'} → ${calc.interState ? 'IGST' : 'CGST + SGST'}` : 'Add your GSTIN in Company Settings for correct tax split.'}
        actions={<>{!id && <Button variant="secondary" loading={save.isPending} onClick={() => submit('draft')}>Save draft</Button>}<Button icon={Save} loading={save.isPending} onClick={() => submit('issued')}>{id ? 'Save' : 'Save & issue'}</Button></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Customer" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value, placeOfSupply: '' })} required>
              <option value="">Select customer</option>{customers?.data?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
            <Select label="Place of supply" value={pos || ''} onChange={(e) => setF({ ...f, placeOfSupply: e.target.value })}>{STATE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            <Input label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            {f.type === 'invoice' && <Input label="Due date" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} hint="Defaults from billing settings" />}
          </div>
          <Toggle label="Prices include GST" checked={f.taxInclusive} onChange={(v) => setF({ ...f, taxInclusive: v })} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500">{['Item', 'HSN/SAC', 'Qty', 'Rate', 'Disc %', 'GST %', 'Amount', ''].map((h) => <th key={h} className="px-1.5 pb-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {f.items.map((it, i) => (
                  <tr key={i} className="align-top">
                    <td className="p-1.5"><select className="input mb-1 py-1.5" value={it.product || ''} onChange={(e) => pickProduct(i, e.target.value)}><option value="">— Custom item —</option>{products?.data?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
                      <input className="input py-1.5" placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                    <td className="w-24 p-1.5"><input className="input py-1.5" value={it.hsnSac || ''} onChange={(e) => setItem(i, { hsnSac: e.target.value })} /></td>
                    <td className="w-20 p-1.5"><input className="input py-1.5" type="number" min="0" step="any" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} /></td>
                    <td className="w-28 p-1.5"><input className="input py-1.5" type="number" min="0" step="any" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} /></td>
                    <td className="w-20 p-1.5"><input className="input py-1.5" type="number" min="0" max="100" value={it.discountPercent || 0} onChange={(e) => setItem(i, { discountPercent: e.target.value })} /></td>
                    <td className="w-24 p-1.5"><select className="input py-1.5" value={it.taxRate} onChange={(e) => setItem(i, { taxRate: Number(e.target.value) })}>{[0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</select></td>
                    <td className="w-28 p-1.5 pt-3 text-right font-medium">{inr(calc.items[i]?.total, { maximumFractionDigits: 2 })}</td>
                    <td className="p-1.5 pt-2.5">{f.items.length > 1 && <button onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-600" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setF({ ...f, items: [...f.items, blank()] })}>Add line</Button>
          <div className="grid gap-4 sm:grid-cols-2"><Textarea label="Notes" value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /><Textarea label="Terms" placeholder="Defaults from billing settings" value={f.terms || ''} onChange={(e) => setF({ ...f, terms: e.target.value })} /></div>
        </Card>
        <Card className="h-fit space-y-2.5 p-5 text-sm lg:sticky lg:top-24">
          <h2 className="mb-2 font-bold text-navy-900 dark:text-white">Summary</h2>
          {[['Taxable value', calc.subtotal], ...(calc.interState ? [['IGST', calc.igst]] : [['CGST', calc.cgst], ['SGST', calc.sgst]])].map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span>{inr(v, { maximumFractionDigits: 2 })}</span></div>)}
          <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Extra discount</span><input className="input w-28 py-1 text-right" type="number" min="0" value={f.discountTotal} onChange={(e) => setF({ ...f, discountTotal: e.target.value })} /></div>
          <div className="flex justify-between"><span className="text-slate-500">Round off</span><span>{calc.roundOff.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-soft-200 pt-3 text-lg font-extrabold dark:border-white/10"><span>Total</span><span>{inr(calc.grandTotal)}</span></div>
        </Card>
      </div>
    </>
  );
}
