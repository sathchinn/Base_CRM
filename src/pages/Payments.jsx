import { useMemo, useState } from 'react';
import { Loader2, Plus, Download, ShieldCheck, AlertTriangle, RotateCcw } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import KpiCard from '@/components/ttc/KpiCard';
import { GATEWAYS, TRANSACTION_STATUSES, downloadCsv, fmtDate, fmtDateTime, fmtMoney, toInputDate } from '@/lib/ttc';
import { cn } from '@/lib/utils';
import SchemaNotice from '@/components/ttc/SchemaNotice';

export default function Payments() {
  const { items: transactions, loading, reload } = useRecords('TTCTransaction', '-paid_at');
  const { items: subscriptions } = useRecords('TTCSubscription');
  const { items: customers } = useRecords('TTCCustomer');

  const [status, setStatus] = useState('all');
  const [gateway, setGateway] = useState('all');
  const [mode, setMode] = useState('all');
  const [search, setSearch] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    customer_id: '',
    subscription_id: '',
    product_name: '',
    amount: '',
    currency: 'INR',
    gateway: 'razorpay',
    method: 'UPI',
    mode: 'test',
    status: 'successful',
    notes: '',
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (status !== 'all' && t.status !== status) return false;
      if (gateway !== 'all' && t.gateway !== gateway) return false;
      if (mode !== 'all' && t.mode !== mode) return false;
      if (term && ![t.transaction_ref, t.customer_name, t.gateway_payment_id, t.gateway_order_id].join(' ').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [transactions, status, gateway, mode, search]);

  const paid = transactions.filter((t) => t.status === 'successful');
  const revenue = paid.reduce((s, t) => s + Number(t.amount || 0), 0);
  const monthRevenue = paid
    .filter((t) => t.paid_at && new Date(t.paid_at).getMonth() === new Date().getMonth() && new Date(t.paid_at).getFullYear() === new Date().getFullYear())
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const pending = transactions.filter((t) => ['pending', 'created'].includes(t.status));
  const failed = transactions.filter((t) => t.status === 'failed');
  const refunds = transactions.filter((t) => ['refunded', 'partially_refunded'].includes(t.status));
  const unmatched = transactions.filter((t) => !t.reconciled && t.status === 'successful');

  const gatewaySplit = useMemo(() => {
    const map = {};
    paid.forEach((t) => {
      map[t.gateway || 'manual'] = (map[t.gateway || 'manual'] || 0) + Number(t.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [paid]);

  const successRate = transactions.filter((t) => ['successful', 'failed'].includes(t.status)).length
    ? Math.round((paid.length / transactions.filter((t) => ['successful', 'failed'].includes(t.status)).length) * 100)
    : 0;

  const pickCustomer = (name) => {
    const customer = customers.find((c) => c.name === name);
    const subs = subscriptions.filter((s) => s.customer_name === name && s.status !== 'cancelled');
    const sub = subs[0];
    setForm((f) => ({
      ...f,
      customer_name: name,
      customer_id: customer?.id || '',
      subscription_id: sub?.id || '',
      product_name: sub?.product_name || '',
      amount: sub ? String(sub.price) : f.amount,
      currency: sub?.currency || f.currency,
    }));
  };

  const pickSubscription = (id) => {
    const sub = subscriptions.find((s) => s.id === id);
    setForm((f) => ({ ...f, subscription_id: id, product_name: sub?.product_name || '', amount: sub ? String(sub.price) : f.amount, currency: sub?.currency || f.currency }));
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await ttcDataClient.functions.invoke('ttcPayments', {
        action: 'record',
        ...form,
        amount: Number(form.amount),
      });
      if (response?.status >= 400) throw new Error(response?.data?.error || 'Payment could not be recorded');
      setSuccess(`Payment ${response.data?.transaction?.transaction_ref || ''} recorded. Subscription updated.`);
      setRecordOpen(false);
      setForm({ ...form, amount: '', notes: '' });
      reload();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Payment could not be recorded.');
    } finally {
      setSaving(false);
    }
  };

  const toggleReconciled = async (t) => {
    await ttcDataClient.entities.TTCTransaction.update(t.id, { reconciled: !t.reconciled });
    reload();
  };

  const submitRefund = async () => {
    if (!refundTarget) return;
    const amount = Number(refundAmount);
    setSaving(true);
    try {
      const full = amount >= Number(refundTarget.amount || 0);
      await ttcDataClient.entities.TTCTransaction.update(refundTarget.id, {
        status: full ? 'refunded' : 'partially_refunded',
        refund_amount: amount,
        refund_reference: `RF-${Date.now().toString(36).toUpperCase()}`,
        notes: `${refundTarget.notes || ''} Refund of ${fmtMoney(amount, refundTarget.currency)} processed.`.trim(),
      });
      await ttcDataClient.entities.TTCAuditLog.create({
        action: 'refund_recorded',
        entity_type: 'TTCTransaction',
        record_id: refundTarget.id,
        summary: `${refundTarget.transaction_ref}: ${fmtMoney(amount, refundTarget.currency)} refunded`,
        actor: 'Finance',
        at: new Date().toISOString(),
      });
      setRefundTarget(null);
      setRefundAmount(0);
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Financial ledger</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Payments &amp; Transactions</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Every rupee tracked with a unique reference. Gateway webhooks are verified server-side.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv('ttc-transactions.csv', filtered.map((t) => ({
              ref: t.transaction_ref, customer: t.customer_name, gateway: t.gateway, amount: t.amount, currency: t.currency,
              status: t.status, mode: t.mode, date: fmtDate(t.paid_at), payment_id: t.gateway_payment_id, reconciled: t.reconciled,
            })))}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" disabled title="Payment ledger schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> Record payment</Button>
        </div>
      </header>

      <SchemaNotice title="Payment ledger is not connected">
        The current TTC database does not yet contain a verified transaction ledger or gateway webhook records. Revenue is therefore shown as zero rather than estimated. Recording payments, refunds and reconciliation are disabled until the financial schema and server-side gateway verification are implemented.
      </SchemaNotice>
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[12px] text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> {success}
          <button type="button" onClick={() => setSuccess('')} className="ml-auto text-[11px] underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total collected" value={fmtMoney(revenue)} sub={`${paid.length} successful`} icon={ShieldCheck} />
        <KpiCard label="This month" value={fmtMoney(monthRevenue)} sub={`${successRate}% success rate`} icon={ShieldCheck} tone="sky" />
        <KpiCard label="Pending" value={fmtMoney(pending.reduce((s, t) => s + Number(t.amount || 0), 0))} sub={`${pending.length} awaiting`} icon={AlertTriangle} tone="amber" />
        <KpiCard label="Refunds" value={refunds.length} sub={fmtMoney(refunds.reduce((s, t) => s + Number(t.refund_amount || 0), 0))} icon={RotateCcw} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <p className="eyebrow">Revenue by gateway</p>
          <ul className="mt-3 space-y-2">
            {gatewaySplit.map(([name, amount]) => (
              <li key={name}>
                <div className="mb-1 flex items-baseline justify-between text-[12px] capitalize">
                  <span>{name}</span>
                  <span className="font-mono tnum">{fmtMoney(amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${revenue ? Math.max((amount / revenue) * 100, 3) : 0}%` }} />
                </div>
              </li>
            ))}
            {gatewaySplit.length === 0 && <li className="text-[12px] text-muted-foreground">No successful payments yet.</li>}
          </ul>
        </div>
        <div className="panel p-4">
          <p className="eyebrow">Integrity checks</p>
          <ul className="mt-3 space-y-2 text-[11.5px]">
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Unmatched payments</span><span className="font-mono">{unmatched.length}</span></li>
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Failed payments</span><span className="font-mono">{failed.length}</span></li>
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Live transactions</span><span className="font-mono">{transactions.filter((t) => t.mode === 'live').length}</span></li>
            <li className="flex items-center justify-between"><span className="text-muted-foreground">Test transactions</span><span className="font-mono">{transactions.filter((t) => t.mode !== 'live').length}</span></li>
          </ul>
          <p className="mt-3 rounded-lg bg-muted px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
            Webhook endpoint: <span className="font-mono">/functions/ttcPayments?action=webhook&amp;provider=razorpay</span>. Add the gateway webhook
            secrets on the dashboard Secrets page before switching payment mode to live.
          </p>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, customer, gateway ID" className="h-9 max-w-[280px] text-[13px]" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px] capitalize">
            <option value="all">All statuses</option>
            {TRANSACTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={gateway} onChange={(e) => setGateway(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px] capitalize">
            <option value="all">All gateways</option>
            {GATEWAYS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px] capitalize">
            <option value="all">Live &amp; test</option>
            <option value="live">Live only</option>
            <option value="test">Test only</option>
          </select>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Reference</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Gateway</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Mode</th>
                  <th className="px-3 py-2.5 font-medium">Reconciled</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((t) => (
                  <tr key={t.id} className={cn('transition-colors hover:bg-muted/40', !t.reconciled && t.status === 'successful' && 'bg-amber-500/5')}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-[11.5px]">{t.transaction_ref}</p>
                      <p className="truncate font-mono text-[9.5px] text-muted-foreground">{t.gateway_payment_id || t.gateway_order_id || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-[12.5px]">{t.customer_name}</td>
                    <td className="px-3 py-3 text-[12px] capitalize text-muted-foreground">{t.gateway} · {t.method || '—'}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{fmtDateTime(t.paid_at)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[12.5px] tnum">{fmtMoney(t.amount, t.currency)}</td>
                    <td className="px-3 py-3"><StatusBadge label={t.status} /></td>
                    <td className="px-3 py-3 text-[11px] capitalize text-muted-foreground">{t.mode}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleReconciled(t)}
                        className={cn('rounded-md border px-1.5 py-0.5 text-[10px]', t.reconciled ? 'text-emerald-600' : 'text-amber-600')}
                      >
                        {t.reconciled ? 'Matched' : 'Unmatched'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status === 'successful' && (
                        <button type="button" onClick={() => { setRefundTarget(t); setRefundAmount(Number(t.amount || 0)); }} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-[12px] text-muted-foreground">No transactions match this view.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
          <form onSubmit={recordPayment} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Customer *</Label>
                <select value={form.customer_name} onChange={(e) => pickCustomer(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Subscription</Label>
                <select value={form.subscription_id} onChange={(e) => pickSubscription(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">No subscription</option>
                  {subscriptions.filter((s) => s.customer_name === form.customer_name).map((s) => (
                    <option key={s.id} value={s.id}>{s.product_name} · {s.plan_type}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Amount *</Label>
                <Input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Currency</Label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {['INR', 'USD', 'EUR', 'AED'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Gateway</Label>
                <select value={form.gateway} onChange={(e) => setForm({ ...form, gateway: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  {GATEWAYS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Method</Label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {['UPI', 'Card', 'Netbanking', 'Wallet', 'Bank transfer', 'manual'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Mode</Label>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  <option value="test">Test</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  <option value="successful">Successful</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Notes / gateway reference</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="UTR, settlement batch, remark…" />
            </div>
            <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              Successful payments are verified server-side, activate the linked subscription and write an audit entry.
            </p>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setRecordOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record payment'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(refundTarget)} onOpenChange={(v) => !v && setRefundTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record a refund</DialogTitle></DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">
            {refundTarget?.transaction_ref} · {refundTarget?.customer_name} · collected {fmtMoney(refundTarget?.amount, refundTarget?.currency)}
          </p>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">Refund amount</Label>
            <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" onClick={() => setRefundTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={submitRefund}>Record refund</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}