import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Clock, Receipt, Loader2, CheckCircle2, XCircle, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, PageHeader, Button, StatusBadge, Badge, Progress, PageLoader, ErrorState, Modal, Input, cx } from '../../components/ui';
import { useApiQuery } from '../../lib/hooks';
import { api, post, refreshSession } from '../../lib/api';
import { openCashfreeCheckout } from '../../lib/cashfree';
import { inr, date, dateTime, limitLabel, titleCase } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { useCan } from '../../lib/permissions';

function CheckoutModal({ plan, cycle, onClose }) {
  const [coupon, setCoupon] = useState('');
  const [q, setQ] = useState(null);
  const [busy, setBusy] = useState(false);
  const getQuote = async (code) => {
    try { setQ((await post('/company/subscription/quote', { planId: plan._id, billingCycle: cycle, couponCode: code || undefined })).data); }
    catch (e) { toast.error(e.message); if (code) getQuote(''); }
  };
  useEffect(() => { getQuote(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = async () => {
    setBusy(true);
    try {
      const r = await post('/company/subscription/checkout', { planId: plan._id, billingCycle: cycle, couponCode: q?.coupon ? coupon : undefined });
      await openCashfreeCheckout(r.data); // redirects to Cashfree, then back to ?order_id=
    } catch (e) { toast.error(e.message); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${plan.name} — ${titleCase(cycle)}`} description="Secure payment by Cashfree Payments (UPI, cards, net banking, wallets)."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={CreditCard} loading={busy} disabled={!q} onClick={pay}>Pay {q ? inr(q.total, { maximumFractionDigits: 2 }) : ''}</Button></>}>
      {!q ? <PageLoader /> : (
        <div className="space-y-3 text-sm">
          <div className="flex gap-2"><Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} className="flex-1" /><Button variant="secondary" onClick={() => getQuote(coupon)} disabled={!coupon}>Apply</Button></div>
          {q.coupon && <p className="text-emerald-600">Coupon {q.coupon.code} applied{q.coupon.description && ` — ${q.coupon.description}`}</p>}
          {[['Plan price', q.amount], ...(q.discount ? [['Discount', -q.discount]] : []), ['Taxable amount', q.taxableAmount], [`GST (${q.gstRate}%)`, q.gst]].map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span>{inr(v, { maximumFractionDigits: 2 })}</span></div>)}
          <div className="flex justify-between border-t border-soft-200 pt-3 text-lg font-extrabold dark:border-white/10"><span>Total</span><span>{inr(q.total, { maximumFractionDigits: 2 })}</span></div>
        </div>
      )}
    </Modal>
  );
}

function PaymentReturn({ orderId, onDone }) {
  const [state, setState] = useState({ status: 'checking' });
  const tries = useRef(0);
  useEffect(() => {
    let timer;
    const check = async () => {
      try {
        const r = await api(`/company/subscription/verify/${encodeURIComponent(orderId)}`);
        if (r.data.status === 'pending' && tries.current++ < 10) { timer = setTimeout(check, 3000); return; }
        setState(r.data);
        if (r.data.status === 'paid') { await refreshSession().catch(() => {}); onDone(); }
      } catch (e) { setState({ status: 'error', reason: e.message }); }
    };
    check();
    return () => clearTimeout(timer);
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = state.status === 'paid';
  return (
    <Card className={cx('mb-6 flex items-center gap-4 p-5', ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10' : '')}>
      {state.status === 'checking' || state.status === 'pending' ? <Loader2 className="h-6 w-6 animate-spin text-royal-600" /> : ok ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <XCircle className="h-6 w-6 text-red-500" />}
      <div><p className="font-semibold">{{ checking: 'Confirming your payment with Cashfree…', pending: 'Payment is still processing…', paid: 'Payment successful — your subscription is active!', failed: 'Payment failed', expired: 'Payment session expired', error: 'Could not confirm payment' }[state.status]}</p>
        <p className="text-sm text-slate-500">{ok ? 'A tax invoice has been emailed to you and is available below.' : state.reason || (state.status === 'pending' ? 'This can take a minute. You can refresh this page safely.' : 'No money was captured. You can try again.')}</p></div>
    </Card>
  );
}

function PlatformInvoiceModal({ id, onClose }) {
  const { data } = useApiQuery(['pinv', id], `/company/subscription/invoices/${id}`);
  const i = data?.data;
  return (
    <Modal open onClose={onClose} size="lg" title="Tax invoice" footer={<Button icon={Printer} onClick={() => window.print()}>Print / PDF</Button>}>
      {!i ? <PageLoader /> : (
        <div className="print-doc space-y-4 bg-white p-4 text-sm text-slate-800">
          <div className="flex justify-between border-b-2 border-navy-900 pb-3"><div><b className="text-lg">{i.seller?.legalName}</b><p>{i.seller?.address}</p>{i.seller?.gstin && <p>GSTIN: {i.seller.gstin}</p>}<p>{i.seller?.phone}</p></div>
            <div className="text-right"><b className="text-royal-700">TAX INVOICE</b><p>{i.number}</p><p>{date(i.issuedAt)}</p></div></div>
          <div><p className="text-xs uppercase text-slate-500">Billed to</p><b>{i.billedTo?.name}</b><p>{i.billedTo?.address}</p>{i.billedTo?.gstin && <p>GSTIN: {i.billedTo.gstin}</p>}</div>
          <table className="w-full"><tbody>
            <tr className="border-b"><td className="py-2">{i.description}<p className="text-xs text-slate-500">{date(i.periodStart)} – {date(i.periodEnd)} · SAC 997331</p></td><td className="text-right">{inr(i.amount, { maximumFractionDigits: 2 })}</td></tr>
            {i.discount > 0 && <tr><td className="py-1">Discount</td><td className="text-right">-{inr(i.discount, { maximumFractionDigits: 2 })}</td></tr>}
            <tr><td className="py-1">Taxable value</td><td className="text-right">{inr(i.taxableAmount, { maximumFractionDigits: 2 })}</td></tr>
            {i.igst ? <tr><td>IGST</td><td className="text-right">{inr(i.igst, { maximumFractionDigits: 2 })}</td></tr> : <><tr><td>CGST</td><td className="text-right">{inr(i.cgst, { maximumFractionDigits: 2 })}</td></tr><tr><td>SGST</td><td className="text-right">{inr(i.sgst, { maximumFractionDigits: 2 })}</td></tr></>}
            <tr className="border-t-2 border-navy-900 text-base font-bold"><td className="py-2">Total paid</td><td className="text-right">{inr(i.total, { maximumFractionDigits: 2 })}</td></tr>
          </tbody></table>
        </div>
      )}
    </Modal>
  );
}

export default function Subscription() {
  const can = useCan();
  const qc = useQueryClient();
  const support = useAuth((s) => s.session?.support);
  const [params, setParams] = useSearchParams();
  const orderId = params.get('order_id');
  const [annual, setAnnual] = useState(true);
  const [checkout, setCheckout] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const { data, isLoading, error, refetch } = useApiQuery('company-subscription', '/company/subscription');
  const { data: payments } = useApiQuery('company-payments', '/company/subscription/payments');
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const { subscription, effective, plan, limits, seatsUsed, plans } = data.data;
  const manage = can('core.subscription.manage');
  const reload = () => { qc.invalidateQueries({ queryKey: ['company-subscription'] }); qc.invalidateQueries({ queryKey: ['company-payments'] }); };
  const cancelSub = async (resume) => {
    if (!resume && !window.confirm('Cancel at the end of the current period? You keep full access until then.')) return;
    try { await post(`/company/subscription/${resume ? 'resume' : 'cancel'}`); toast.success(resume ? 'Subscription resumed' : 'Subscription will end at period end'); reload(); refreshSession().catch(() => {}); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Subscription & billing" description="Your plan, usage, payments and invoices." />
      {orderId && <PaymentReturn orderId={orderId} onDone={() => { reload(); setTimeout(() => setParams({}, { replace: true }), 6000); }} />}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-sm text-slate-500">Current plan</p><h2 className="mt-1 text-2xl font-extrabold text-navy-900 dark:text-white">{plan?.name || 'No plan'}</h2>
              <div className="mt-2 flex items-center gap-2"><StatusBadge status={effective.state} />{subscription?.billingCycle && <Badge>{titleCase(subscription.billingCycle)}</Badge>}{subscription?.cancelAtPeriodEnd && <Badge color="amber">Cancels at period end</Badge>}</div></div>
            <div className="text-right"><p className="text-sm text-slate-500">{effective.state === 'trialing' ? 'Trial ends' : ['grace', 'read_only', 'blocked'].includes(effective.state) ? 'Ended' : subscription?.cancelAtPeriodEnd ? 'Ends' : 'Renews'}</p>
              <p className="font-display text-xl font-bold">{date(effective.endsAt)}</p>{effective.daysLeft > 0 && <p className="text-xs text-slate-500">{effective.daysLeft} day(s) left</p>}</div>
          </div>
          {effective.warning && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{effective.warning}</p>}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div><div className="mb-1.5 flex justify-between text-sm"><span>Users</span><span className="text-slate-500">{seatsUsed} / {limitLabel(limits.users)}</span></div><Progress value={seatsUsed} max={limits.users} /></div>
            <div className="text-sm text-slate-500">Employees {limitLabel(limits.employees)} · Invoices {limitLabel(limits.invoicesPerMonth)}/mo · Storage {limitLabel(limits.storageMB)} MB</div>
          </div>
          {manage && subscription?.status === 'active' && <div className="mt-5"><Button size="sm" variant="ghost" onClick={() => cancelSub(subscription.cancelAtPeriodEnd)}>{subscription.cancelAtPeriodEnd ? 'Resume subscription' : 'Cancel subscription'}</Button></div>}
        </Card>
        <Card className="p-6"><h2 className="mb-4 font-bold">History</h2>
          <ul className="max-h-72 space-y-3 overflow-y-auto text-sm">{(subscription?.history || []).map((h, i) => <li key={i} className="flex gap-3"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="font-medium">{titleCase(h.event)}</p>{h.note && <p className="text-xs text-slate-500">{h.note}</p>}<p className="text-xs text-slate-400">{dateTime(h.at)}</p></div></li>)}</ul></Card>
      </div>

      <div className="mb-5 mt-10 flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-bold text-navy-900 dark:text-white">{effective.state === 'active' ? 'Change or renew plan' : 'Choose a plan'}</h2>
        <div className="inline-flex rounded-xl bg-soft-100 p-1 text-sm font-semibold dark:bg-white/5">
          <button onClick={() => setAnnual(false)} className={cx('rounded-lg px-4 py-1.5', !annual && 'bg-white shadow-sm dark:bg-navy-800')}>Monthly</button>
          <button onClick={() => setAnnual(true)} className={cx('rounded-lg px-4 py-1.5', annual && 'bg-white shadow-sm dark:bg-navy-800')}>Annual</button></div></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{plans.map((p) => {
        const current = plan && p._id === plan._id;
        return <Card key={p._id} className={cx('flex flex-col p-5', current && 'ring-2 ring-royal-600')}>
          <div className="flex items-center justify-between"><h3 className="font-bold">{p.name}</h3>{current && <Badge color="blue">Current</Badge>}</div>
          <p className="mt-3 font-display text-2xl font-extrabold">{inr(annual ? Math.round(p.priceAnnual / 12) : p.priceMonthly)}<span className="text-sm font-medium text-slate-500">/mo</span></p>
          <p className="text-xs text-slate-500">{annual ? `${inr(p.priceAnnual)} / year` : 'billed monthly'} + GST</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">{p.features.slice(0, 5).map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-royal-600" />{f}</li>)}</ul>
          {manage ? <Button className="mt-5" variant={current ? 'secondary' : 'primary'} icon={CreditCard} onClick={() => setCheckout(p)}>{current ? 'Renew' : effective.state === 'active' ? 'Switch plan' : 'Choose plan'}</Button>
            : <p className="mt-5 text-xs text-slate-500">Ask your Company Owner to change plans.</p>}
        </Card>;
      })}</div>

      <Card className="mt-10"><h2 className="flex items-center gap-2 p-5 pb-3 font-bold"><Receipt className="h-5 w-5 text-royal-600" />Payments & invoices</h2>
        {!payments?.data?.length ? <p className="px-5 pb-5 text-sm text-slate-500">No payments yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="border-y border-soft-200 dark:border-white/10"><tr>{['Date', 'Order', 'Plan', 'Amount', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-soft-200 dark:divide-white/10">{payments.data.map((p) => <tr key={p._id}><td className="td">{dateTime(p.createdAt)}</td><td className="td text-xs">{p.orderId}</td><td className="td">{p.plan?.name} · {p.billingCycle}</td>
              <td className="td font-semibold">{inr(p.total, { maximumFractionDigits: 2 })}</td><td className="td"><StatusBadge status={p.status} />{p.failureReason && <p className="text-xs text-red-500">{p.failureReason}</p>}</td>
              <td className="td">{p.invoice && <Button size="sm" variant="ghost" onClick={() => setInvoice(p.invoice)}>Invoice</Button>}</td></tr>)}</tbody></table></div>)}
      </Card>
      <p className="mt-6 text-center text-sm text-slate-500">Need help with billing? <a href={`mailto:${support?.email}`} className="font-semibold text-royal-600">{support?.email}</a>{support?.phone && <> · {support.phone}</>}</p>
      {checkout && <CheckoutModal plan={checkout} cycle={annual ? 'annual' : 'monthly'} onClose={() => setCheckout(null)} />}
      {invoice && <PlatformInvoiceModal id={invoice} onClose={() => setInvoice(null)} />}
    </>
  );
}
