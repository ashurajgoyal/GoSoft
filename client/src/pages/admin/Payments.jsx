import { useState } from 'react';
import { RefreshCw, Undo2 } from 'lucide-react';
import { Card, PageHeader, Button, Input, Select, Modal, Tabs, Pagination, PageLoader, EmptyState, StatusBadge, Stat, Badge } from '../../components/ui';
import { useApiQuery, useApiMutation } from '../../lib/hooks';
import { inr, dateTime, num } from '../../lib/format';
import ResourcePage from '../../components/ResourcePage';

function RefundModal({ p, onClose }) {
  const refunded = (p.refunds || []).reduce((s, r) => s + r.amount, 0);
  const [f, setF] = useState({ amount: Math.round((p.total - refunded) * 100) / 100, note: '' });
  const m = useApiMutation({ path: `/admin/payments/${p._id}/refund`, invalidate: ['admin-payments'], success: 'Refund initiated with Cashfree', onSuccess: onClose });
  return <Modal open onClose={onClose} title={`Refund ${p.orderId}`} description={`Paid ${inr(p.total, { maximumFractionDigits: 2 })} · already refunded ${inr(refunded, { maximumFractionDigits: 2 })}`}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={m.isPending} onClick={() => window.confirm('Send this refund to Cashfree? Money will be returned to the customer.') && m.mutate({ body: { amount: Number(f.amount), note: f.note || undefined } })}>Refund</Button></>}>
    <div className="grid gap-4"><Input label="Amount (₹)" type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><Input label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div></Modal>;
}

function PaymentsTable() {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [refund, setRefund] = useState(null);
  const { data, isLoading } = useApiQuery('admin-payments', '/admin/payments', { status, q, page });
  const sync = useApiMutation({ invalidate: ['admin-payments'], success: (r) => `Status: ${r.data.status}` });
  const stat = (s) => data?.stats?.find((x) => x._id === s) || { n: 0, amount: 0 };
  const total = (data?.stats || []).reduce((a, s) => a + s.n, 0);
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-4"><Stat label="Collected" value={inr(stat('paid').amount + stat('partially_refunded').amount)} tone="green" /><Stat label="Successful" value={num(stat('paid').n)} />
        <Stat label="Failed" value={num(stat('failed').n)} tone="red" /><Stat label="Success rate" value={total ? `${Math.round(((stat('paid').n + stat('refunded').n + stat('partially_refunded').n) / total) * 100)}%` : '—'} tone="violet" /></div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-soft-200 p-4 dark:border-white/10 sm:flex-row"><Input placeholder="Order ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="flex-1" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-44">{['all', 'paid', 'pending', 'failed', 'expired', 'refunded', 'partially_refunded'].map((s) => <option key={s}>{s}</option>)}</Select></div>
        {isLoading ? <PageLoader /> : !data?.data?.length ? <EmptyState title="No payments yet" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Date', 'Company', 'Plan', 'Order', 'Amount', 'Mode', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((p) => (
              <tr key={p._id}><td className="td whitespace-nowrap text-slate-500">{dateTime(p.createdAt)}</td><td className="td">{p.company?.name}</td><td className="td">{p.plan?.name} · {p.billingCycle}{p.coupon?.code && <Badge color="violet" className="ml-1">{p.coupon.code}</Badge>}</td>
                <td className="td font-mono text-xs">{p.orderId}{p.cfPaymentId && <p className="text-slate-400">CF {p.cfPaymentId} · {p.paymentMethod}</p>}</td><td className="td font-semibold">{inr(p.total, { maximumFractionDigits: 2 })}</td>
                <td className="td"><Badge color={p.mode === 'production' ? 'red' : 'amber'}>{p.mode}</Badge></td><td className="td"><StatusBadge status={p.status} />{p.failureReason && <p className="max-w-[180px] truncate text-xs text-red-500" title={p.failureReason}>{p.failureReason}</p>}</td>
                <td className="td"><div className="flex gap-1">{['pending', 'created', 'failed'].includes(p.status) && <Button size="sm" variant="ghost" icon={RefreshCw} title="Re-check with Cashfree" onClick={() => sync.mutate({ path: `/admin/payments/${p._id}/sync` })} />}
                  {['paid', 'partially_refunded'].includes(p.status) && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setRefund(p)}>Refund</Button>}</div></td></tr>))}</tbody></table></div>)}
        <Pagination meta={data?.meta} onPage={setPage} />
      </Card>
      {refund && <RefundModal p={refund} onClose={() => setRefund(null)} />}
    </>
  );
}

function WebhookLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiQuery('admin-webhooks', '/admin/webhook-logs', { page });
  return <Card>{isLoading ? <PageLoader /> : !data?.data?.length ? <EmptyState title="No webhooks received yet" description="Cashfree webhooks appear here once your public HTTPS webhook URL is configured." /> : (
    <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Received', 'Event', 'Order', 'Signature', 'Result'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((w) => <tr key={w._id}><td className="td whitespace-nowrap">{dateTime(w.createdAt)}</td><td className="td">{w.type}</td><td className="td font-mono text-xs">{w.orderId}</td>
        <td className="td"><Badge color={w.signatureValid ? 'green' : 'red'}>{w.signatureValid ? 'valid' : 'invalid'}</Badge></td><td className="td text-sm">{w.result}</td></tr>)}</tbody></table></div>)}
    <Pagination meta={data?.meta} onPage={setPage} /></Card>;
}

function PlatformInvoices() {
  const { data, isLoading } = useApiQuery('admin-pinv', '/admin/platform-invoices');
  return <Card>{isLoading ? <PageLoader /> : !data?.data?.length ? <EmptyState title="No invoices yet" /> : (
    <div className="overflow-x-auto"><table className="w-full"><thead className="border-b border-soft-200 dark:border-white/10"><tr>{['Number', 'Date', 'Billed to', 'Taxable', 'GST', 'Total'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-soft-200 dark:divide-white/10">{data.data.map((i) => <tr key={i._id}><td className="td font-semibold">{i.number}</td><td className="td">{dateTime(i.issuedAt)}</td><td className="td">{i.billedTo?.name}<p className="text-xs text-slate-500">{i.billedTo?.gstin}</p></td>
        <td className="td">{inr(i.taxableAmount, { maximumFractionDigits: 2 })}</td><td className="td">{inr((i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), { maximumFractionDigits: 2 })}</td><td className="td font-semibold">{inr(i.total, { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>)}</Card>;
}

export function Coupons() {
  return <ResourcePage title="Coupons" singular="coupon" endpoint="/admin/coupons" defaults={{ type: 'percent', active: true, oncePerCompany: true, billingCycles: ['monthly', 'annual'] }}
    columns={[{ key: 'code', label: 'Code', render: (c) => <span className="font-mono font-bold">{c.code}</span> }, { label: 'Discount', render: (c) => (c.type === 'percent' ? `${c.value}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ''}` : inr(c.value)) },
      { label: 'Valid', render: (c) => `${c.validFrom ? new Date(c.validFrom).toLocaleDateString('en-IN') : 'Now'} → ${c.validTo ? new Date(c.validTo).toLocaleDateString('en-IN') : 'No expiry'}` },
      { label: 'Used', render: (c) => `${c.redemptions}${c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}` }, { label: 'Status', render: (c) => <Badge color={c.active ? 'green' : 'gray'}>{c.active ? 'Active' : 'Inactive'}</Badge> }]}
    fields={[{ name: 'code', label: 'Code', required: true, upper: true }, { name: 'description', label: 'Description' }, { name: 'type', label: 'Type', type: 'select', options: [['percent', 'Percentage'], ['flat', 'Flat amount (₹)']] },
      { name: 'value', label: 'Value', type: 'number', required: true }, { name: 'maxDiscount', label: 'Max discount (₹, % coupons)', type: 'number' }, { name: 'maxRedemptions', label: 'Max redemptions', type: 'number' },
      { name: 'validFrom', label: 'Valid from', type: 'date' }, { name: 'validTo', label: 'Valid to', type: 'date' }, { name: 'plans', label: 'Limit to plans (none = all)', type: 'ref', multiple: true, endpoint: '/admin/plans' },
      { name: 'oncePerCompany', label: 'Once per company', type: 'checkbox' }, { name: 'active', label: 'Active', type: 'checkbox' }]}
    transformIn={(b) => ({ ...b, maxDiscount: b.maxDiscount || null, maxRedemptions: b.maxRedemptions || null, validFrom: b.validFrom || null, validTo: b.validTo || null })} />;
}

export default function Payments() {
  const [tab, setTab] = useState('payments');
  return (
    <>
      <PageHeader title="Payments" description="Every Cashfree transaction, refunds, webhook deliveries and GST invoices." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'payments', label: 'Transactions' }, { value: 'invoices', label: 'Subscription invoices' }, { value: 'webhooks', label: 'Webhook logs' }]} />
      {tab === 'payments' ? <PaymentsTable /> : tab === 'invoices' ? <PlatformInvoices /> : <WebhookLogs />}
    </>
  );
}
