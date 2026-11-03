import { useMemo, useState } from 'react';
import { Plus, Loader2, Zap, Play, Pencil, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import { fmtDateTime, titleCase } from '@/lib/ttc';
import { cn } from '@/lib/utils';

const TRIGGERS = [
  { key: 'lead_created', label: 'Lead created' },
  { key: 'keyword', label: 'Inbound keyword' },
  { key: 'button', label: 'Interactive button' },
  { key: 'trial_started', label: 'Trial started' },
  { key: 'trial_expiring', label: 'Trial expiring' },
  { key: 'payment_confirmed', label: 'Payment confirmed' },
  { key: 'renewal_due', label: 'Renewal due' },
  { key: 'booking_confirmed', label: 'Booking confirmed' },
  { key: 'training_reminder', label: 'Training reminder' },
  { key: 'follow_up', label: 'Follow-up due' },
  { key: 'reengagement', label: 'Re-engagement' },
];

const EMPTY = { name: '', category: 'welcome', trigger: 'lead_created', keywords: '', conditions: '', message_body: '', enabled: true };

export default function AutomationCenter() {
  const { items: automations, loading, reload } = useRecords('TTCAutomation', 'created_date');
  const { items: runs, reload: reloadRuns } = useRecords('TTCAutomationRun', '-run_at');
  const [dialog, setDialog] = useState({ open: false, automation: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const visibleRuns = useMemo(
    () => runs.filter((r) => filter === 'all' || r.status === filter),
    [runs, filter]
  );

  const openEdit = (automation) => {
    setForm(automation ? { ...EMPTY, ...automation, keywords: (automation.keywords || []).join(', ') } : EMPTY);
    setDialog({ open: true, automation });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        keywords: String(form.keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      delete payload.run_count;
      delete payload.failure_count;
      delete payload.last_run_at;
      if (dialog.automation) await ttcDataClient.entities.TTCAutomation.update(dialog.automation.id, payload);
      else await ttcDataClient.entities.TTCAutomation.create(payload);
      setDialog({ open: false, automation: null });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (automation) => {
    await ttcDataClient.entities.TTCAutomation.update(automation.id, { enabled: !automation.enabled });
    reload();
  };

  const retry = async (run) => {
    await ttcDataClient.entities.TTCAutomationRun.create({
      automation_id: run.automation_id,
      automation_name: run.automation_name,
      trigger_event: run.trigger_event,
      status: 'success',
      detail: `Retried manually — ${run.detail || 'delivered'}`,
      target: run.target || '',
      run_at: new Date().toISOString(),
    });
    const parent = automations.find((a) => a.id === run.automation_id);
    if (parent) {
      await ttcDataClient.entities.TTCAutomation.update(parent.id, { run_count: Number(parent.run_count || 0) + 1 });
    }
    reloadRuns();
    reload();
  };

  const enabledCount = automations.filter((a) => a.enabled).length;
  const failures = runs.filter((r) => r.status === 'failed').length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Automation</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Automation Center</h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
            {enabledCount} of {automations.length} workflows live · {runs.length} executions logged
            {failures > 0 && <span className="text-rose-600"> · {failures} failed</span>}
          </p>
        </div>
        <Button size="sm" disabled title="Automation creation requires a reviewed mapping to the existing WhatsApp action schema"><Plus className="mr-1.5 h-3.5 w-3.5" /> New automation</Button>
      </header>

      {loading ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {automations.map((a) => (
            <article key={a.id} className="panel flex flex-col p-4">
              <div className="flex items-start gap-2">
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', a.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                  <Zap className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{a.name}</p>
                  <p className="text-[10.5px] text-muted-foreground">{titleCase(a.category)} · {TRIGGERS.find((t) => t.key === a.trigger)?.label || a.trigger}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(a)}
                  className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', a.enabled ? 'bg-primary' : 'bg-muted-foreground/30')}
                  aria-label="Toggle automation"
                >
                  <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', a.enabled ? 'left-4' : 'left-0.5')} />
                </button>
              </div>

              <p className="mt-2.5 line-clamp-3 flex-1 rounded-lg bg-muted/40 px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {a.message_body || 'No message body set.'}
              </p>

              {(a.keywords || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.keywords.map((k) => (
                    <span key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">{k}</span>
                  ))}
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 text-[10.5px] text-muted-foreground">
                <span>{a.run_count || 0} runs{a.failure_count ? ` · ${a.failure_count} failed` : ''}</span>
                <span className="flex items-center gap-1">
                  {a.enabled ? <StatusBadge label="active" /> : <StatusBadge label="paused" />}
                  <button type="button" disabled title="Existing WhatsApp automation actions are read-only in this dashboard" onClick={() => openEdit(a)} className="grid h-6 w-6 place-items-center rounded-md border hover:bg-muted">
                    <Pencil className="h-3 w-3" />
                  </button>
                </span>
              </div>
            </article>
          ))}
          {automations.length === 0 && (
            <div className="panel col-span-full py-16 text-center text-[12.5px] text-muted-foreground">No automations configured yet.</div>
          )}
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <p className="text-[13px] font-semibold">Execution log</p>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="ml-auto h-8 rounded-lg border bg-background px-2 text-[12px] capitalize">
            <option value="all">All runs</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Automation</th>
                <th className="px-3 py-2 font-medium">Trigger</th>
                <th className="px-3 py-2 font-medium">Detail</th>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleRuns.slice(0, 40).map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-2 text-[12px] font-medium">{r.automation_name}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{titleCase(r.trigger_event)}</td>
                  <td className="max-w-[320px] px-3 py-2"><p className="truncate text-[11.5px] text-muted-foreground">{r.detail || '—'}</p></td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-muted-foreground">{fmtDateTime(r.run_at)}</td>
                  <td className="px-3 py-2">
                    <span className={cn('inline-flex items-center gap-1 text-[11px]', r.status === 'failed' ? 'text-rose-600' : 'text-emerald-600')}>
                      {r.status === 'failed' ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === 'failed' && (
                      <Button size="sm" variant="outline" disabled title="Automation runs are executed by the existing WhatsApp engine" className="h-6 px-1.5 text-[10px]" onClick={() => retry(r)}>
                        <RotateCcw className="mr-1 h-2.5 w-2.5" /> Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {visibleRuns.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[12px] text-muted-foreground">No executions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog.automation ? 'Edit automation' : 'New automation'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Category</Label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  {['welcome', 'keyword', 'button', 'trial', 'payment', 'renewal', 'demo', 'follow_up', 're_engagement'].map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Trigger</Label>
                <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {TRIGGERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Keywords (comma separated)</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="price, trial, demo" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Conditions</Label>
              <Input value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} placeholder="Only when trial is not active" />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Message</Label>
              <Textarea rows={4} value={form.message_body} onChange={(e) => setForm({ ...form, message_body: e.target.value })} placeholder="Hi {{name}}, …" />
            </div>
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Automation enabled
            </label>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setDialog({ open: false, automation: null })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save automation'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}