import { useMemo, useState } from 'react';
import { Plus, Loader2, RefreshCcw, Play, Ban, PauseCircle, Download } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import KpiCard from '@/components/ttc/KpiCard';
import { PLAN_TYPES, SUBSCRIPTION_STATUSES, daysUntil, downloadCsv, fmtDate, fmtMoney, toInputDate } from '@/lib/ttc';
import { logAudit } from '@/lib/automations';
import { cn } from '@/lib/utils';
import SchemaNotice from '@/components/ttc/SchemaNotice';

const PLAN_DAYS = { daily: 1, weekly: 7, monthly: 30, trial: 3, custom: 30 };

export default function Subscriptions() {
  const { items: subscriptions, loading, reload } = useRecords('TTCSubscription', '-created_date');
  const { items: customers } = useRecords('TTCCustomer');
  const { items: products } = useRecords('TTCProduct');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    product_name: '',
    plan_type: 'monthly',
    price: 0,
    currency: 'INR',
    start_date: toInputDate(new Date()),
    expiry_date: toInputDate(new Date(Date.now() + 30 * 86400000)),
    renewal_date: toInputDate(new Date(Date.now() + 30 * 86400000)),
    status: 'pending_payment',
    auto_renew: false,
    notes: '',
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subscriptions.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (plan !== 'all' && s.plan_type !== plan) return false;
      if (term && ![s.customer_name, s.product_name].join(' ').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [subscriptions, status, plan, search]);

  const active = subscriptions.filter((s) => s.status === 'active');
  const trials = subscriptions.filter((s) => s.status === 'trial');
  const expiring = subscriptions.filter((s) => {
    const d = daysUntil(s.expiry_date);
    return (s.status === 'active' || s.status === 'trial') && d !== null && d >= 0 && d <= 7;
  });
  const mrr = active.reduce((sum, s) => sum + Number(s.price || 0) * (s.plan_type === 'monthly' ? 1 : s.plan_type === 'weekly' ? 4 : s.plan_type === 'daily' ? 30 : 1), 0);

  const pickCustomer = (name) => {
    const customer = customers.find((c) => c.name === name);
    setForm((f) => ({ ...f, customer_name: name, customer_id: customer?.id || '' }));
  };

  const pickProduct = (name) => {
    const product = products.find((p) => p.name === name);
    const priceKey = `${form.plan_type}_price`;
    setForm((f) => ({ ...f, product_name: name, product_id: product?.id || '', price: product?.[priceKey] ?? f.price, currency: product?.currency || f.currency }));
  };

  const pickPlan = (value) => {
    const product = products.find((p) => p.name === form.product_name);
    const days = PLAN_DAYS[value] || 30;
    const price = value === 'trial' ? 0 : product?.[`${value}_price`] ?? form.price;
    setForm((f) => ({
      ...f,
      plan_type: value,
      price,
      expiry_date: toInputDate(new Date(Date.now() + days * 86400000)),
      renewal_date: toInputDate(new Date(Date.now() + days * 86400000)),
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.customer_name || !form.product_name) {
      setError('Choose a customer and a product.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price || 0),
        start_date: form.start_date ? new Date(form.start_date).toISOString() : '',
        expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : '',
        renewal_date: form.renewal_date ? new Date(form.renewal_date).toISOString() : '',
        access_granted: ['active', 'trial'].includes(form.status),
      };
      const created = await ttcDataClient.entities.TTCSubscription.create(payload);
      await logAudit('subscription_created', 'TTCSubscription', created.id, `${payload.customer_name} · ${payload.product_name} (${payload.plan_type})`);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err?.message || 'Could not create this subscription.');
    } finally {
      setSaving(false);
    }
  };

  const update = async (record, patch, note) => {
    await ttcDataClient.entities.TTCSubscription.update(record.id, patch);
    await logAudit('subscription_update', 'TTCSubscription', record.id, `${record.customer_name}: ${note}`);
    reload();
  };

  const activate = (record) => {
    const days = PLAN_DAYS[record.plan_type] || 30;
    const start = new Date();
    const expiry = new Date(start.getTime() + days * 86400000);
    update(
      record,
      { status: 'active', access_granted: true, start_date: start.toISOString(), expiry_date: expiry.toISOString(), renewal_date: expiry.toISOString() },
      'manually activated by admin'
    );
  };

  const renew = (record) => {
    const days = PLAN_DAYS[record.plan_type] || 30;
    const base = record.expiry_date && new Date(record.expiry_date) > new Date() ? new Date(record.expiry_date) : new Date();
    const expiry = new Date(base.getTime() + days * 86400000);
    update(record, { status: 'active', access_granted: true, expiry_date: expiry.toISOString(), renewal_date: expiry.toISOString() }, `renewed to ${fmtDate(expiry)}`);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Access &amp; renewals</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Subscriptions</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Trials, paid plans and renewals — access status kept separate from payment status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv('ttc-subscriptions.csv', filtered.map((s) => ({
                customer: s.customer_name, product: s.product_name, plan: s.plan_type, price: s.price, currency: s.currency,
                status: s.status, start: fmtDate(s.start_date), expiry: fmtDate(s.expiry_date), renewal: fmtDate(s.renewal_date),
              })))
            }
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" disabled title="Paid subscription schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> New subscription</Button>
        </div>
      </header>

      <SchemaNotice title="Live trial access is connected; paid subscriptions are not yet connected">
        Existing free-trial records and TradingView access states are read from the TTC database. Paid subscription contracts, billing cycles and renewal records do not yet have a dedicated schema. Use the existing trial/access workflow for indicator access; this page will not fabricate paid subscriptions.
      </SchemaNotice>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active paid" value={active.length} sub={`${fmtMoney(mrr)} monthly run-rate`} icon={Play} />
        <KpiCard label="Active trials" value={trials.length} sub="Convert before expiry" icon={RefreshCcw} tone="sky" />
        <KpiCard label="Expiring in 7 days" value={expiring.length} sub="Send renewal reminders" icon={RefreshCcw} tone="amber" />
        <KpiCard label="Expired / cancelled" value={subscriptions.filter((s) => ['expired', 'cancelled'].includes(s.status)).length} icon={Ban} tone="rose" />
      </div>

      {expiring.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-800 dark:text-amber-200">
          <span className="font-medium">Renewal watch:</span>{' '}
          {expiring.slice(0, 4).map((s) => `${s.customer_name} (${daysUntil(s.expiry_date)}d)`).join(' · ')}
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or product" className="h-9 max-w-[240px] text-[13px]" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px] capitalize">
            <option value="all">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px] capitalize">
            <option value="all">All plans</option>
            {PLAN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price</th>
                  <th className="px-3 py-2.5 font-medium">Start</th>
                  <th className="px-3 py-2.5 font-medium">Expiry</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Access</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => {
                  const left = daysUntil(s.expiry_date);
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 text-[13px] font-medium">{s.customer_name}</td>
                      <td className="px-3 py-3 text-[12px] text-muted-foreground">{s.product_name}</td>
                      <td className="px-3 py-3 text-[12px] capitalize text-muted-foreground">{s.plan_type}</td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] tnum">{fmtMoney(s.price, s.currency)}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{fmtDate(s.start_date)}</td>
                      <td className="px-3 py-3">
                        <span className={cn('font-mono text-[11px]', left !== null && left <= 3 && left >= 0 ? 'text-amber-600' : left !== null && left < 0 ? 'text-rose-600' : 'text-muted-foreground')}>
                          {fmtDate(s.expiry_date)}
                        </span>
                      </td>
                      <td className="px-3 py-3"><StatusBadge label={s.status} /></td>
                      <td className="px-3 py-3">
                        <span className={cn('text-[11px]', s.access_granted ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {s.access_granted ? 'Granted' : 'Not granted'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {s.status !== 'active' && (
                            <button type="button" disabled title="Use the existing Access Actions workflow to grant TradingView access" onClick={() => activate(s)} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">Activate</button>
                          )}
                          {['active', 'expired', 'payment_failed'].includes(s.status) && (
                            <button type="button" disabled title="Paid subscription renewals are not connected" onClick={() => renew(s)} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">Renew</button>
                          )}
                          {s.status !== 'suspended' && s.status !== 'expired' && (
                            <button type="button" disabled title="Use the existing Access Actions workflow to revoke access" onClick={() => update(s, { status: 'suspended', access_granted: false }, 'suspended')} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">
                              <PauseCircle className="h-3 w-3" />
                            </button>
                          )}
                          {s.status !== 'cancelled' && (
                            <button type="button" disabled title="Paid subscription cancellation is not connected" onClick={() => update(s, { status: 'cancelled', access_granted: false }, 'cancelled')} className="rounded-md border px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10">
                              <Ban className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-[12px] text-muted-foreground">No subscriptions match this view.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>New subscription</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Customer *</Label>
                <select value={form.customer_name} onChange={(e) => pickCustomer(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Product *</Label>
                <select value={form.product_name} onChange={(e) => pickProduct(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">Select product</option>
                  {products.filter((p) => p.status !== 'inactive').map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Plan type</Label>
                <select value={form.plan_type} onChange={(e) => pickPlan(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  {PLAN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Price</Label>
                <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Expiry date</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value, renewal_date: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <label className="mt-5 flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} />
                Auto-renew
              </label>
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}
            <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              Activating a paid plan should follow a verified payment. Trials start immediately and convert only after payment confirmation.
            </p>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create subscription'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}