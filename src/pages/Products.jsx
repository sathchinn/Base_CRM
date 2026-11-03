import { useState } from 'react';
import { Plus, Pencil, Loader2, Check, Power } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import { fmtMoney } from '@/lib/ttc';
import { cn } from '@/lib/utils';
import SchemaNotice from '@/components/ttc/SchemaNotice';

const EMPTY = {
  name: '',
  description: '',
  platform: 'TradingView',
  status: 'active',
  features: '',
  daily_price: 0,
  weekly_price: 0,
  monthly_price: 0,
  currency: 'INR',
  trial_available: true,
  trial_days: 3,
};

export default function Products() {
  const { items: products, loading, reload } = useRecords('TTCProduct', 'created_date');
  const { items: subscriptions } = useRecords('TTCSubscription');
  const [dialog, setDialog] = useState({ open: false, product: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openEdit = (product) => {
    setForm(product ? { ...EMPTY, ...product, features: (product.features || []).join('\n') } : EMPTY);
    setDialog({ open: true, product });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        features: String(form.features || '').split('\n').map((f) => f.trim()).filter(Boolean),
        daily_price: Number(form.daily_price || 0),
        weekly_price: Number(form.weekly_price || 0),
        monthly_price: Number(form.monthly_price || 0),
        trial_days: Number(form.trial_days || 3),
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      if (dialog.product) await ttcDataClient.entities.TTCProduct.update(dialog.product.id, payload);
      else await ttcDataClient.entities.TTCProduct.create(payload);
      setDialog({ open: false, product: null });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (product) => {
    await ttcDataClient.entities.TTCProduct.update(product.id, { status: product.status === 'active' ? 'inactive' : 'active' });
    reload();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Products &amp; Pricing</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Disabling a product hides it from new subscriptions but never deletes history.</p>
        </div>
        <Button size="sm" disabled title="Product catalogue schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> New product</Button>
      </header>

      <SchemaNotice title="Product catalogue is not connected">
        No product catalogue table exists in the current TTC database. Product and pricing changes are disabled rather than stored in a separate backend.
      </SchemaNotice>
      {loading ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const activeCount = subscriptions.filter((s) => s.product_name === p.name && s.status === 'active').length;
            const trialCount = subscriptions.filter((s) => s.product_name === p.name && s.status === 'trial').length;
            return (
              <article key={p.id} className={cn('panel flex flex-col p-5', p.status !== 'active' && 'opacity-70')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold">{p.name}</h2>
                    <p className="text-[11px] text-muted-foreground">{p.platform}</p>
                  </div>
                  <StatusBadge label={p.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{p.description || 'No description'}</p>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5">
                  {[['Daily', p.daily_price], ['Weekly', p.weekly_price], ['Monthly', p.monthly_price]].map(([label, price]) => (
                    <div key={label} className="text-center">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="font-mono text-[12.5px] font-medium tnum">{price ? fmtMoney(price, p.currency) : '—'}</p>
                    </div>
                  ))}
                </div>

                <ul className="mt-3 flex-1 space-y-1">
                  {(p.features || []).slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <p className="text-[10.5px] text-muted-foreground">
                    {activeCount} active · {trialCount} trial
                    {p.trial_available && ` · ${p.trial_days || 3}d trial`}
                  </p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => toggle(p)} title="Enable / disable" className="grid h-7 w-7 place-items-center rounded-lg border hover:bg-muted">
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => openEdit(p)} className="grid h-7 w-7 place-items-center rounded-lg border hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {products.length === 0 && (
            <div className="panel col-span-full py-16 text-center text-[12.5px] text-muted-foreground">No products yet — add your first indicator.</div>
          )}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog.product ? 'Edit product' : 'New product'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Product name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Platform</Label>
                <Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Daily price</Label>
                <Input type="number" min="0" value={form.daily_price} onChange={(e) => setForm({ ...form, daily_price: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Weekly price</Label>
                <Input type="number" min="0" value={form.weekly_price} onChange={(e) => setForm({ ...form, weekly_price: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Monthly price</Label>
                <Input type="number" min="0" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Currency</Label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {['INR', 'USD', 'EUR', 'AED'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Trial days</Label>
                <Input type="number" min="0" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} />
              </div>
              <label className="mt-5 flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={form.trial_available} onChange={(e) => setForm({ ...form, trial_available: e.target.checked })} />
                Free trial available
              </label>
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Features (one per line)</Label>
                <Textarea rows={3} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder={'Non-repainting signals\nSession-based alerts'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setDialog({ open: false, product: null })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save product'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}