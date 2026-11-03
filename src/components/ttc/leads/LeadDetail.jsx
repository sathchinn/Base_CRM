import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LEAD_SOURCES, LEAD_STAGES, SESSIONS, fmtDateTime } from '@/lib/ttc';
import StatusBadge from '@/components/ttc/StatusBadge';
import { Clock, User } from 'lucide-react';

const FIELDS = [
  ['WhatsApp', 'whatsapp_number'],
  ['Email', 'email'],
  ['TradingView', 'tradingview_username'],
  ['Source', 'lead_source'],
  ['Session', 'trading_session'],
  ['Campaign', 'campaign'],
  ['Assigned to', 'assigned_to'],
];

export default function LeadDetail({ lead, open, onOpenChange, onEdit, onDelete, onPatch }) {
  const [notes, setNotes] = useState(lead?.notes || '');
  const [saving, setSaving] = useState(false);

  if (!lead) return null;

  const save = async (patch) => {
    setSaving(true);
    try {
      await onPatch(patch);
    } finally {
      setSaving(false);
    }
  };

  const history = [...(lead.stage_history || [])].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {lead.name}
            <StatusBadge label={lead.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border bg-muted/30 p-4">
          {FIELDS.map(([label, key]) => (
            <div key={key}>
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <p className="truncate text-[13px] capitalize">{lead[key] || '—'}</p>
            </div>
          ))}
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Follow-up</p>
            <p className="text-[13px]">{fmtDateTime(lead.follow_up_date)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Last contacted</p>
            <p className="text-[13px]">{fmtDateTime(lead.last_contacted)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Move stage</span>
            <select
              value={lead.status}
              onChange={(e) => save({ status: e.target.value })}
              className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize"
            >
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Follow-up date</span>
            <Input
              type="datetime-local"
              onChange={(e) => save({ follow_up_date: e.target.value ? new Date(e.target.value).toISOString() : '' })}
              className="h-9 text-[13px]"
            />
          </label>
        </div>

        <div>
          <Label className="mb-1.5 block text-[11px] text-muted-foreground">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Call summary, objections, requirements…" />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" disabled={saving || notes === (lead.notes || '')} onClick={() => save({ notes })}>
              Save note
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Stage history</p>
          <ul className="space-y-2">
            {history.length === 0 && <li className="text-[12px] text-muted-foreground">No stage changes recorded yet.</li>}
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="capitalize">{String(h.stage || '').replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">· {fmtDateTime(h.at)}</span>
                {h.by && <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground"><User className="h-3 w-3" />{h.by}</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-[10.5px] text-muted-foreground">Lead records are retained for audit history.</span>
          <Button size="sm" onClick={() => onEdit(lead)}>Edit lead</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}