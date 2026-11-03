import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import useRecords from '@/hooks/useRecords';
import StatusBadge from '@/components/ttc/StatusBadge';
import LeadDialog from '@/components/ttc/leads/LeadDialog';
import LeadDetail from '@/components/ttc/leads/LeadDetail';
import { LEAD_SOURCES, LEAD_STAGES, downloadCsv, fmtDate, fmtDateTime, isOverdue, leadStage } from '@/lib/ttc';
import { runTrigger, logAudit } from '@/lib/automations';

const PAGE_SIZE = 10;

export default function Leads() {
  const [searchParams] = useSearchParams();
  const { items: leads, loading, reload } = useRecords('TTCLead');
  const { items: team } = useRecords('TTCTeamMember');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [source, setSource] = useState('all');
  const [stage, setStage] = useState('all');
  const [owner, setOwner] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [onlyDupes, setOnlyDupes] = useState(false);
  const [dialog, setDialog] = useState({ open: false, lead: null });
  const [detail, setDetail] = useState(null);
  const [toBeDeleted, setToBeDeleted] = useState(null);

  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setPage(1);
  }, [searchParams]);

  const teamNames = team.map((t) => t.name).filter(Boolean);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = leads.filter((l) => {
      const haystack = [l.name, l.whatsapp_number, l.tradingview_username, l.email, l.campaign].join(' ').toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (source !== 'all' && l.lead_source !== source) return false;
      if (stage !== 'all' && l.status !== stage) return false;
      if (owner !== 'all' && (l.assigned_to || '') !== owner) return false;
      if (onlyDupes && !l.is_duplicate) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (sort === 'followup') return new Date(a.follow_up_date || 8640000000000000) - new Date(b.follow_up_date || 8640000000000000);
      return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    });
    return rows;
  }, [leads, search, source, stage, owner, sort, onlyDupes]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const duplicateCount = leads.filter((l) => l.is_duplicate).length;

  const duplicateGroups = useMemo(() => {
    const map = new Map();
    leads.forEach((l) => {
      const key = (l.whatsapp_number || l.tradingview_username || '').replace(/[^\dA-Za-z]/g, '').toLowerCase();
      if (!key) return;
      map.set(key, [...(map.get(key) || []), l]);
    });
    return [...map.values()].filter((group) => group.length > 1);
  }, [leads]);

  const exportRows = () =>
    downloadCsv(
      'ttc-leads.csv',
      filtered.map((l) => ({
        name: l.name,
        whatsapp: l.whatsapp_number,
        email: l.email,
        tradingview: l.tradingview_username,
        source: l.lead_source,
        session: l.trading_session,
        stage: leadStage(l.status).label,
        owner: l.assigned_to,
        created: fmtDate(l.created_date),
        follow_up: fmtDate(l.follow_up_date),
        notes: (l.notes || '').replace(/\n/g, ' '),
      }))
    );

  const handleSaved = async (payload, isEdit, original) => {
    await reload();
    if (!isEdit) {
      await runTrigger('lead_created', { name: payload.name, whatsapp_number: payload.whatsapp_number });
      await logAudit('lead_created', 'TTCLead', '', `Lead captured — ${payload.name}`);
    } else if (original && original.status !== payload.status) {
      await logAudit('stage_changed', 'TTCLead', original.id, `${payload.name}: ${leadStage(original.status).label} → ${leadStage(payload.status).label}`);
    }
    if (duplicateGroups.length) {
      const keys = new Set(duplicateGroups.map((g) => g[0].id));
      await Promise.all([...keys].map((id) => ttcDataClient.entities.TTCLead.update(id, { is_duplicate: true })));
      await reload();
    }
  };

  const patchLead = async (patch) => {
    if (!detail) return;
    const merged = { ...patch };
    if (patch.status && patch.status !== detail.status) {
      merged.stage_history = [
        ...(detail.stage_history || []),
        { stage: patch.status, at: new Date().toISOString(), by: 'Team' },
      ];
      merged.last_contacted = new Date().toISOString();
    }
    const updated = await ttcDataClient.entities.TTCLead.update(detail.id, merged);
    setDetail(updated);
    reload();
  };

  const confirmDelete = async () => {
    if (!toBeDeleted) return;
    await ttcDataClient.entities.TTCLead.delete(toBeDeleted.id);
    await logAudit('lead_deleted', 'TTCLead', toBeDeleted.id, `Lead deleted — ${toBeDeleted.name}`);
    setToBeDeleted(null);
    setDetail(null);
    reload();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Pipeline · {leads.length} records</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Leads</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Every TradingView comment, WhatsApp enquiry and referral in one book.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportRows}><Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV</Button>
          <Button size="sm" onClick={() => setDialog({ open: true, lead: null })}><Plus className="mr-1.5 h-3.5 w-3.5" /> New lead</Button>
        </div>
      </header>

      {duplicateGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {duplicateGroups.length} possible duplicate {duplicateGroups.length === 1 ? 'group' : 'groups'} detected on number or TradingView handle.
          <button type="button" onClick={() => setOnlyDupes(!onlyDupes)} className="ml-auto font-medium underline underline-offset-2">
            {onlyDupes ? 'Show all leads' : 'Review flagged'}
          </button>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, number, handle…"
              className="h-9 pl-8 text-[13px]"
            />
          </div>
          <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="all">All stages</option>
            {LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="all">All sources</option>
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={owner} onChange={(e) => { setOwner(e.target.value); setPage(1); }} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="all">All owners</option>
            {teamNames.map((n) => <option key={n}>{n}</option>)}
            <option value="">Unassigned</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="newest">Newest first</option>
            <option value="followup">Follow-up date</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[13px] font-medium">No leads match these filters</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Clear the filters or capture a new lead.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">WhatsApp</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Stage</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 font-medium">Follow-up</th>
                  <th className="px-3 py-2.5 font-medium">Last contact</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((l) => (
                  <tr key={l.id} className="group cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setDetail(l)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{l.name}</span>
                        {l.is_duplicate && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-300">dup</span>}
                      </div>
                      <p className="font-mono text-[10.5px] text-muted-foreground">@{l.tradingview_username || '—'}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11.5px] text-muted-foreground">{l.whatsapp_number || '—'}</td>
                    <td className="px-3 py-3 text-[12px] text-muted-foreground">{l.lead_source || '—'}</td>
                    <td className="px-3 py-3"><StatusBadge label={leadStage(l.status).label} /></td>
                    <td className="px-3 py-3 text-[12px]">{l.assigned_to || <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="px-3 py-3">
                      <span className={`font-mono text-[11px] ${isOverdue(l.follow_up_date) ? 'text-rose-600' : 'text-muted-foreground'}`}>
                        {fmtDate(l.follow_up_date)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{fmtDate(l.last_contacted)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDialog({ open: true, lead: l }); }} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" disabled title="Lead history is retained in the TTC database" onClick={(e) => { e.stopPropagation(); setToBeDeleted(l); }} className="grid h-7 w-7 place-items-center rounded-lg text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <p className="text-[11.5px] text-muted-foreground">
            Showing {filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11.5px]" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
            <span className="px-2 font-mono text-[11px] text-muted-foreground">{current} / {pages}</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[11.5px]" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <LeadDialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} lead={dialog.lead} teamNames={teamNames} onSaved={handleSaved} />

      <LeadDetail
        lead={detail}
        open={Boolean(detail)}
        onOpenChange={(v) => !v && setDetail(null)}
        onEdit={(l) => { setDetail(null); setDialog({ open: true, lead: l }); }}
        onDelete={(l) => setToBeDeleted(l)}
        onPatch={patchLead}
      />

      <Dialog open={Boolean(toBeDeleted)} onOpenChange={(v) => !v && setToBeDeleted(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this lead?</DialogTitle></DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            {toBeDeleted?.name} will be removed from the pipeline. Linked customers, subscriptions and payments stay intact.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToBeDeleted(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}