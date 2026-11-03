import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import { LEAD_SOURCES, LEAD_STAGES, SESSIONS, normalizePhone, normalizeTv, toInputDateTime, leadStage } from '@/lib/ttc';

const EMPTY = {
  name: '',
  whatsapp_number: '',
  email: '',
  tradingview_username: '',
  lead_source: 'TradingView',
  post_url: '',
  trading_session: 'Asian Session',
  campaign: '',
  status: 'new',
  assigned_to: '',
  follow_up_date: '',
  notes: '',
};

export default function LeadDialog({ open, onOpenChange, lead, teamNames = [], onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setDupes([]);
    setForm(lead ? { ...EMPTY, ...lead, follow_up_date: toInputDateTime(lead.follow_up_date) } : EMPTY);
  }, [open, lead]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const phone = normalizePhone(form.whatsapp_number);
      const tv = normalizeTv(form.tradingview_username);
      if ((phone || tv) && dupes.length === 0) {
        const page = await ttcDataClient.entities.TTCLead.list({ sort: '-created_date', limit: 500 });
        const rows = page?.items || [];
        const matches = rows.filter(
          (r) =>
            r.id !== lead?.id &&
            ((phone && normalizePhone(r.whatsapp_number) === phone) || (tv && normalizeTv(r.tradingview_username) === tv))
        );
        if (matches.length) {
          setDupes(matches);
          setSaving(false);
          return;
        }
      }

      const payload = {
        ...form,
        follow_up_date: form.follow_up_date ? new Date(form.follow_up_date).toISOString() : '',
        lead_date: lead?.lead_date || new Date().toISOString(),
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      delete payload.stage_history;

      if (lead) {
        await ttcDataClient.entities.TTCLead.update(lead.id, payload);
      } else {
        await ttcDataClient.entities.TTCLead.create({
          ...payload,
          stage_history: [{ stage: payload.status, at: new Date().toISOString(), by: 'Team' }],
        });
      }
      onOpenChange(false);
      onSaved?.(payload, Boolean(lead), lead);
    } catch (err) {
      setError(err?.message || 'Could not save this lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? 'Edit lead' : 'Capture a new lead'}</DialogTitle>
        </DialogHeader>

        {dupes.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-[12px] font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" /> Potential duplicate
            </p>
            <ul className="mt-1.5 space-y-1">
              {dupes.map((d) => (
                <li key={d.id} className="text-[11.5px] text-amber-800/80 dark:text-amber-200/80">
                  {d.name} · {d.whatsapp_number || 'no number'} · {leadStage(d.status).label}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-amber-800/70 dark:text-amber-200/70">
              Click save again to record this lead anyway.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Customer name *</Label>
              <Input value={form.name} onChange={set('name')} placeholder="Full name" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">WhatsApp number</Label>
              <Input value={form.whatsapp_number} onChange={set('whatsapp_number')} placeholder="91XXXXXXXXXX" required />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="name@email.com" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">TradingView username</Label>
              <Input value={form.tradingview_username} onChange={set('tradingview_username')} placeholder="handle" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Lead source</Label>
              <select value={form.lead_source} onChange={set('lead_source')} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Trading session</Label>
              <select value={form.trading_session} onChange={set('trading_session')} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                {SESSIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Pipeline stage</Label>
              <select value={form.status} onChange={set('status')} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                {LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Assigned to</Label>
              <select value={form.assigned_to} onChange={set('assigned_to')} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                <option value="">Unassigned</option>
                {teamNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">TradingView post URL</Label>
              <Input value={form.post_url} onChange={set('post_url')} placeholder="https://tradingview.com/chart/…" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Campaign</Label>
              <Input value={form.campaign} onChange={set('campaign')} placeholder="e.g. Crude open drive" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Follow-up date</Label>
              <Input type="datetime-local" value={form.follow_up_date} onChange={set('follow_up_date')} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">Notes</Label>
            <Textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Context, requirements, objections…" />
          </div>

          {error && <p className="text-[12px] text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {lead ? 'Save changes' : dupes.length ? 'Save anyway' : 'Create lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}