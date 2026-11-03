import { useMemo, useState } from 'react';
import { Search, Loader2, Plus, Pencil, AlertTriangle, Circle } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import { LEAD_SOURCES, fmtDate, fmtDateTime, fmtMoney, normalizePhone } from '@/lib/ttc';
import { logAudit } from '@/lib/automations';

const EMPTY = {
  name: '',
  whatsapp_number: '',
  email: '',
  tradingview_username: '',
  lead_source: 'TradingView',
  assigned_to: '',
  status: 'active',
  notes: '',
  duplicate_trial_flag: false,
};

export default function Customers() {
  const { items: customers, loading, reload } = useRecords('TTCCustomer');
  const { items: subscriptions } = useRecords('TTCSubscription');
  const { items: transactions } = useRecords('TTCTransaction');
  const { items: bookings } = useRecords('TTCBooking');
  const { items: leads } = useRecords('TTCLead');
  const { items: conversations } = useRecords('TTCConversation');
  const { items: messages } = useRecords('TTCWhatsAppMessage');
  const { items: team } = useRecords('TTCTeamMember');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [dialog, setDialog] = useState({ open: false, customer: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const teamNames = team.map((t) => t.name).filter(Boolean);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (!term) return true;
      return [c.name, c.whatsapp_number, c.email, c.tradingview_username, ...(c.previous_usernames || [])].join(' ').toLowerCase().includes(term);
    });
  }, [customers, search, status]);

  const openEdit = (customer) => {
    setForm(customer ? { ...EMPTY, ...customer } : EMPTY);
    setDialog({ open: true, customer });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      if (dialog.customer) {
        const changedHandle =
          form.tradingview_username &&
          dialog.customer.tradingview_username &&
          form.tradingview_username !== dialog.customer.tradingview_username;
        if (changedHandle) {
          payload.previous_usernames = [...new Set([...(dialog.customer.previous_usernames || []), dialog.customer.tradingview_username])];
        }
        await ttcDataClient.entities.TTCCustomer.update(dialog.customer.id, payload);
        await logAudit('customer_updated', 'TTCCustomer', dialog.customer.id, `${form.name} updated${changedHandle ? ' (TradingView handle changed, old handle preserved)' : ''}`);
      } else {
        const created = await ttcDataClient.entities.TTCCustomer.create({ ...payload, joined_date: new Date().toISOString() });
        await logAudit('customer_created', 'TTCCustomer', created.id, `${form.name} added as customer`);
      }
      setDialog({ open: false, customer: null });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const detail = selected ? customers.find((c) => c.id === selected.id) || selected : null;
  const customerSubs = detail ? subscriptions.filter((s) => s.customer_name === detail.name) : [];
  const customerTxns = detail ? transactions.filter((t) => t.customer_name === detail.name) : [];
  const customerBookings = detail ? bookings.filter((b) => b.customer_name === detail.name) : [];
  const customerLeads = detail ? leads.filter((l) => l.name === detail.name || (detail.whatsapp_number && normalizePhone(l.whatsapp_number) === normalizePhone(detail.whatsapp_number))) : [];
  const customerConversation = detail ? conversations.find((c) => normalizePhone(c.whatsapp_number) === normalizePhone(detail.whatsapp_number)) : null;
  const customerMessages = customerConversation ? messages.filter((m) => m.conversation_id === customerConversation.id) : [];

  const timeline = useMemo(() => {
    if (!detail) return [];
    const events = [
      ...customerLeads.map((l) => ({ at: l.created_date, label: 'Lead captured', detail: `Source: ${l.lead_source || '—'}`, type: 'lead' })),
      ...customerSubs.map((s) => ({ at: s.start_date || s.created_date, label: `Subscription · ${s.product_name}`, detail: `${s.plan_type} · ${s.status}`, type: 'subscription' })),
      ...customerTxns.map((t) => ({ at: t.paid_at || t.created_date, label: `Payment ${fmtMoney(t.amount, t.currency)}`, detail: `${t.gateway} · ${t.status}`, type: 'payment' })),
      ...customerBookings.map((b) => ({ at: b.scheduled_at, label: b.event_name, detail: `${b.type} · ${b.status}`, type: 'booking' })),
      ...customerMessages.slice(-10).map((m) => ({ at: m.sent_at, label: m.direction === 'inbound' ? 'WhatsApp received' : 'WhatsApp sent', detail: m.body, type: 'message' })),
    ];
    return events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [detail, customerLeads, customerSubs, customerTxns, customerBookings, customerMessages]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Unified profiles · {customers.length} customers</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Customers</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">One profile per trader, connecting every lead, message, demo and payment.</p>
        </div>
        <Button size="sm" onClick={() => openEdit(null)}><Plus className="mr-1.5 h-3.5 w-3.5" /> New WhatsApp contact</Button>
      </header>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers, handles, numbers…" className="h-9 pl-8 text-[13px]" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px] capitalize">
            <option value="all">All statuses</option>
            {['active', 'trial', 'expired', 'churned'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">WhatsApp</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr key={c.id} className="group cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{c.name}</span>
                        {c.duplicate_trial_flag && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      </div>
                      <p className="font-mono text-[10.5px] text-muted-foreground">@{c.tradingview_username || '—'}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11.5px] text-muted-foreground">{c.whatsapp_number || '—'}</td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">{c.lead_source || '—'}</td>
                    <td className="px-3 py-3"><StatusBadge label={c.status} /></td>
                    <td className="px-3 py-3 text-[12px]">{c.assigned_to || '—'}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{fmtDate(c.joined_date || c.created_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" disabled title="Only customer name can be edited from this view" onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="grid h-7 w-7 place-items-center rounded-lg opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-[12px] text-muted-foreground">No customers match this view.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  {detail.name}
                  <StatusBadge label={detail.status} />
                  {detail.duplicate_trial_flag && <StatusBadge label="duplicate trial review" tone="warning" />}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['WhatsApp', detail.whatsapp_number || '—'],
                  ['Email', detail.email || '—'],
                  ['TradingView', `@${detail.tradingview_username || '—'}`],
                  ['Source', detail.lead_source || '—'],
                  ['Owner', detail.assigned_to || 'Unassigned'],
                  ['Joined', fmtDate(detail.joined_date || detail.created_date)],
                  ['Subscriptions', customerSubs.length],
                  ['Payments', customerTxns.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                    <p className="truncate text-[12.5px]">{value}</p>
                  </div>
                ))}
              </div>

              {(detail.previous_usernames || []).length > 0 && (
                <p className="rounded-lg bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
                  Previous TradingView handles kept on file: {(detail.previous_usernames || []).map((u) => `@${u}`).join(', ')}
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Subscriptions</p>
                  <ul className="space-y-1.5">
                    {customerSubs.map((s) => (
                      <li key={s.id} className="rounded-lg border px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-medium">{s.product_name}</span>
                          <StatusBadge label={s.status} />
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {s.plan_type} · {fmtDate(s.start_date)} → {fmtDate(s.expiry_date)}
                        </p>
                      </li>
                    ))}
                    {customerSubs.length === 0 && <li className="text-[11.5px] text-muted-foreground">No subscriptions yet</li>}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Payments</p>
                  <ul className="space-y-1.5">
                    {customerTxns.slice(0, 5).map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-lg border px-2.5 py-2">
                        <span className="font-mono text-[10.5px] text-muted-foreground">{fmtDate(t.paid_at)} · {t.gateway}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[11.5px]">{fmtMoney(t.amount, t.currency)}</span>
                          <StatusBadge label={t.status} />
                        </span>
                      </li>
                    ))}
                    {customerTxns.length === 0 && <li className="text-[11.5px] text-muted-foreground">No payments recorded</li>}
                  </ul>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Activity timeline</p>
                <ol className="relative space-y-2.5 border-l pl-3.5">
                  {timeline.slice(0, 12).map((e, i) => (
                    <li key={i} className="relative">
                      <Circle className="absolute -left-[19px] top-1 h-2 w-2 fill-current text-primary/40" />
                      <p className="text-[12px] font-medium">{e.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{e.detail}</p>
                      <p className="font-mono text-[9.5px] text-muted-foreground/70">{fmtDateTime(e.at)}</p>
                    </li>
                  ))}
                  {timeline.length === 0 && <li className="text-[11.5px] text-muted-foreground">No activity yet</li>}
                </ol>
              </div>

              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[12px]">{detail.notes || 'No notes yet.'}</p>
              </div>

              <div className="flex justify-end border-t pt-3">
                <Button size="sm" onClick={() => { const c = detail; setSelected(null); openEdit(c); }}>Edit customer</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{dialog.customer ? 'Edit customer' : 'New customer'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">WhatsApp</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} required /></div>
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">Email</Label><Input value={form.email} disabled placeholder="Not linked in the current identity schema" /></div>
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">TradingView username</Label><Input value={form.tradingview_username} disabled placeholder="Linked during trial registration" /></div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Lead source</Label>
                <select value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Assigned to</Label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">Unassigned</option>
                  {teamNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
                <select disabled value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  {['active', 'trial', 'expired', 'churned'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <label className="mt-5 flex items-center gap-2 text-[12px]">
                <input type="checkbox" checked={Boolean(form.duplicate_trial_flag)} onChange={(e) => setForm({ ...form, duplicate_trial_flag: e.target.checked })} />
                Flag duplicate free-trial attempt
              </label>
            </div>
            <div><Label className="mb-1 block text-[11px] text-muted-foreground">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setDialog({ open: false, customer: null })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save customer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}