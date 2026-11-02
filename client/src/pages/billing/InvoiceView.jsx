import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Printer, Pencil, IndianRupee, Ban, FileMinus, Mail, ArrowLeft } from 'lucide-react';
import { Button, Modal, Input, Select, PageLoader, ErrorState, StatusBadge } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { useCan } from '../../lib/permissions';
import { inr, date, titleCase } from '../../lib/format';
import { amountInWords } from '../../lib/gst';
import { stateName } from './Masters';

const TITLES = { invoice: 'Tax Invoice', proforma: 'Proforma Invoice', credit_note: 'Credit Note', debit_note: 'Debit Note' };

export function InvoiceDocument({ invoice: i, company: c }) {
  const addr = c.address || {};
  return (
    <div className="print-doc mx-auto max-w-4xl bg-white p-8 text-[13px] text-slate-800 shadow-sm print:p-0 print:shadow-none">
      <div className="flex items-start justify-between border-b-2 border-navy-900 pb-5">
        <div>
          {c.logoUrl && <img src={c.logoUrl} alt="" className="mb-2 h-12" />}
          <h2 className="text-xl font-extrabold text-navy-900">{c.name}</h2>
          <p className="text-slate-600">{[addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
          {c.gstin && <p><b>GSTIN:</b> {c.gstin}</p>}{c.phone && <p>Ph: {c.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold uppercase tracking-wide text-royal-700">{TITLES[i.type]}</p>
          <p className="mt-2"><b>No:</b> {i.number}</p><p><b>Date:</b> {date(i.date)}</p>{i.dueDate && <p><b>Due:</b> {date(i.dueDate)}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 py-5">
        <div><p className="text-xs font-bold uppercase text-slate-500">Bill to</p><p className="text-base font-bold">{i.customerSnapshot?.name}</p><p>{i.customerSnapshot?.address}</p>{i.customerSnapshot?.gstin && <p><b>GSTIN:</b> {i.customerSnapshot.gstin}</p>}</div>
        <div className="text-right"><p className="text-xs font-bold uppercase text-slate-500">Place of supply</p><p className="font-semibold">{i.placeOfSupply} – {stateName(i.placeOfSupply)}</p><p className="text-slate-500">{i.taxInclusive ? 'Prices inclusive of GST' : 'Prices exclusive of GST'}</p></div>
      </div>
      <table className="w-full border-collapse">
        <thead><tr className="bg-navy-900 text-left text-xs text-white">{['#', 'Item', 'HSN/SAC', 'Qty', 'Rate', 'Taxable', 'GST', 'Amount'].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
        <tbody>{i.items.map((it, n) => (
          <tr key={n} className="border-b border-slate-200">
            <td className="px-2 py-2">{n + 1}</td><td className="px-2 py-2">{it.description}</td><td className="px-2 py-2">{it.hsnSac}</td><td className="px-2 py-2">{it.quantity} {it.unit}</td>
            <td className="px-2 py-2">{inr(it.rate, { maximumFractionDigits: 2 })}</td><td className="px-2 py-2">{inr(it.taxableValue, { maximumFractionDigits: 2 })}</td>
            <td className="px-2 py-2">{it.taxRate}%</td><td className="px-2 py-2 text-right font-medium">{inr(it.total, { maximumFractionDigits: 2 })}</td>
          </tr>))}</tbody>
      </table>
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">Tax summary</p>
          <table className="mt-1 w-full text-xs"><thead><tr className="text-left text-slate-500"><th>Rate</th><th>Taxable</th>{i.interState ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}</tr></thead>
            <tbody>{i.taxSummary.map((t) => <tr key={t.taxRate}><td>{t.taxRate}%</td><td>{inr(t.taxableValue, { maximumFractionDigits: 2 })}</td>{i.interState ? <td>{inr(t.igst, { maximumFractionDigits: 2 })}</td> : <><td>{inr(t.cgst, { maximumFractionDigits: 2 })}</td><td>{inr(t.sgst, { maximumFractionDigits: 2 })}</td></>}</tr>)}</tbody></table>
          <p className="mt-4 text-xs"><b>Amount in words:</b> {amountInWords(i.grandTotal)}</p>
          {c.billingSettings?.bankDetails && <p className="mt-3 whitespace-pre-line text-xs"><b>Bank details:</b><br />{c.billingSettings.bankDetails}</p>}
          {c.billingSettings?.upiId && <p className="text-xs"><b>UPI:</b> {c.billingSettings.upiId}</p>}
        </div>
        <div className="space-y-1.5">
          {[['Taxable value', i.subtotal], ...(i.interState ? [['IGST', i.igst]] : [['CGST', i.cgst], ['SGST', i.sgst]]), ...(i.discountTotal ? [['Discount', -i.discountTotal]] : []), ['Round off', i.roundOff]].map(([l, v]) => (
            <div key={l} className="flex justify-between"><span>{l}</span><span>{inr(v, { maximumFractionDigits: 2 })}</span></div>))}
          <div className="flex justify-between border-t-2 border-navy-900 pt-2 text-base font-extrabold"><span>Grand total</span><span>{inr(i.grandTotal)}</span></div>
          {i.amountPaid > 0 && <><div className="flex justify-between text-emerald-700"><span>Paid</span><span>{inr(i.amountPaid)}</span></div><div className="flex justify-between font-bold"><span>Balance due</span><span>{inr(i.grandTotal - i.amountPaid)}</span></div></>}
        </div>
      </div>
      {(i.notes || i.terms) && <div className="mt-6 grid grid-cols-2 gap-6 text-xs text-slate-600">{i.notes && <p><b>Notes:</b> {i.notes}</p>}{i.terms && <p><b>Terms:</b> {i.terms}</p>}</div>}
      <div className="mt-12 flex justify-between text-xs text-slate-500"><span>This is a computer-generated document.</span><span className="text-right">For {c.name}<br /><br />{c.billingSettings?.signatory || 'Authorised Signatory'}</span></div>
    </div>
  );
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useCan();
  const [pay, setPay] = useState(false);
  const [p, setP] = useState({ amount: '', mode: 'bank', reference: '', date: new Date().toISOString().slice(0, 10) });
  const { data, isLoading, error, refetch } = useApiQuery(['invoice', id], `/company/billing/invoices/${id}`);
  const record = useApiMutation({ path: `/company/billing/invoices/${id}/payments`, invalidate: ['invoice', 'invoices'], success: 'Payment recorded', onSuccess: () => setPay(false) });
  const cancel = useApiMutation({ path: `/company/billing/invoices/${id}/cancel`, invalidate: ['invoice', 'invoices'], success: 'Invoice cancelled' });
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { invoice: i, company, receipts } = data.data;
  const due = Math.round((i.grandTotal - i.amountPaid) * 100) / 100;
  const payable = ['invoice', 'debit_note'].includes(i.type) && !['paid', 'cancelled'].includes(i.status);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3"><button onClick={() => navigate('/app/billing/invoices')} className="rounded-lg p-2 hover:bg-soft-100 dark:hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-xl font-extrabold text-navy-900 dark:text-white">{i.number}</h1><StatusBadge status={i.status} /></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
          {i.customerSnapshot?.email && <a href={`mailto:${i.customerSnapshot.email}?subject=${encodeURIComponent(`${TITLES[i.type]} ${i.number} from ${company.name}`)}&body=${encodeURIComponent(`Dear ${i.customerSnapshot.name},\n\nPlease find ${TITLES[i.type]} ${i.number} for ${inr(i.grandTotal)}.\n\nRegards,\n${company.name}`)}`}><Button variant="secondary" icon={Mail}>Email</Button></a>}
          {payable && can('billing.invoice.edit') && <Button icon={IndianRupee} onClick={() => { setP({ ...p, amount: due }); setPay(true); }}>Record payment</Button>}
          {i.amountPaid === 0 && i.status !== 'cancelled' && can('billing.invoice.edit') && <Link to={`/app/billing/invoices/${id}/edit`}><Button variant="secondary" icon={Pencil}>Edit</Button></Link>}
          {i.type === 'invoice' && i.status !== 'cancelled' && can('billing.invoice.create') && <Link to={`/app/billing/invoices/new?type=credit_note&ref=${id}`}><Button variant="secondary" icon={FileMinus}>Credit note</Button></Link>}
          {i.amountPaid === 0 && i.status !== 'cancelled' && can('billing.invoice.delete') && <Button variant="ghost" icon={Ban} onClick={() => window.confirm('Cancel this document? This cannot be undone.') && cancel.mutate()}>Cancel</Button>}
        </div>
      </div>
      <InvoiceDocument invoice={i} company={company} />
      {receipts.length > 0 && (
        <div className="card mx-auto mt-5 max-w-4xl p-5 print:hidden"><h3 className="mb-3 font-bold">Payments received</h3>
          {receipts.map((r) => <div key={r._id} className="flex justify-between border-b border-soft-200 py-2 text-sm last:border-0 dark:border-white/10"><span>{r.number} · {date(r.date)} · {titleCase(r.mode)} {r.reference && `(${r.reference})`}</span><b>{inr(r.amount)}</b></div>)}
        </div>
      )}
      {pay && (
        <Modal open onClose={() => setPay(false)} title="Record payment" description={`Outstanding ${inr(due)}`}
          footer={<><Button variant="secondary" onClick={() => setPay(false)}>Cancel</Button><Button loading={record.isPending} onClick={() => record.mutate({ body: { ...p, amount: Number(p.amount) } })}>Save receipt</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount (₹)" type="number" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} />
            <Input label="Date" type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} />
            <Select label="Mode" value={p.mode} onChange={(e) => setP({ ...p, mode: e.target.value })}>{['bank', 'upi', 'cash', 'card', 'cheque', 'other'].map((m) => <option key={m}>{m}</option>)}</Select>
            <Input label="Reference / UTR" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} />
          </div>
        </Modal>
      )}
    </>
  );
}
