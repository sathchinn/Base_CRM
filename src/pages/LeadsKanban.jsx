import { useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Loader2, Phone, CalendarClock, AlertTriangle, MessageCircle } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import LeadDetail from '@/components/ttc/leads/LeadDetail';
import LeadDialog from '@/components/ttc/leads/LeadDialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import { LEAD_SOURCES, LEAD_STAGES, fmtDate, isOverdue, leadStage } from '@/lib/ttc';
import { logAudit } from '@/lib/automations';
import { cn } from '@/lib/utils';

export default function LeadsKanban() {
  const { items: leads, loading, reload } = useRecords('TTCLead');
  const { items: team } = useRecords('TTCTeamMember');
  const [source, setSource] = useState('all');
  const [owner, setOwner] = useState('all');
  const [detail, setDetail] = useState(null);
  const [dialog, setDialog] = useState({ open: false, lead: null });

  const teamNames = team.map((t) => t.name).filter(Boolean);

  const visible = useMemo(
    () =>
      leads.filter(
        (l) => (source === 'all' || l.lead_source === source) && (owner === 'all' || (l.assigned_to || '') === owner)
      ),
    [leads, source, owner]
  );

  const columns = useMemo(
    () => LEAD_STAGES.map((s) => ({ ...s, cards: visible.filter((l) => (l.status || 'new') === s.key) })),
    [visible]
  );

  const onDragEnd = async (result) => {
    const { destination, source: from, draggableId } = result;
    if (!destination || destination.droppableId === from.droppableId) return;
    const lead = leads.find((l) => l.id === draggableId);
    if (!lead) return;
    const nextStage = destination.droppableId;
    await ttcDataClient.entities.TTCLead.update(lead.id, {
      status: nextStage,
      last_contacted: new Date().toISOString(),
      stage_history: [...(lead.stage_history || []), { stage: nextStage, at: new Date().toISOString(), by: 'Team' }],
    });
    await logAudit('stage_changed', 'TTCLead', lead.id, `${lead.name}: ${leadStage(lead.status).label} → ${leadStage(nextStage).label}`);
    reload();
  };

  const patchLead = async (patch) => {
    if (!detail) return;
    const merged = { ...patch };
    if (patch.status && patch.status !== detail.status) {
      merged.stage_history = [...(detail.stage_history || []), { stage: patch.status, at: new Date().toISOString(), by: 'Team' }];
    }
    const updated = await ttcDataClient.entities.TTCLead.update(detail.id, merged);
    setDetail(updated);
    reload();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Pipeline board</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Leads Kanban</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Drag a card to move the deal. Every move is written to stage history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="all">All sources</option>
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="all">All owners</option>
            {teamNames.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="grid place-items-center py-24 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="scroll-thin flex gap-3 overflow-x-auto pb-4">
            {columns.map((col) => (
              <div key={col.key} className="w-[268px] shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[12px] font-semibold">{col.label}</p>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{col.cards.length}</span>
                </div>
                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'min-h-[140px] space-y-2 rounded-xl border border-dashed p-2 transition-colors',
                        snapshot.isDraggingOver ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-muted/25'
                      )}
                    >
                      {col.cards.map((lead, index) => (
                        <Draggable draggableId={lead.id} index={index} key={lead.id}>
                          {(drag, state) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              onClick={() => setDetail(lead)}
                              className={cn(
                                'cursor-pointer rounded-xl border bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow',
                                state.isDragging && 'rotate-[1deg] shadow-xl'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[12.5px] font-medium leading-tight">{lead.name}</p>
                                {isOverdue(lead.follow_up_date) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                              </div>
                              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">@{lead.tradingview_username || '—'}</p>
                              <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span className="font-mono">{lead.whatsapp_number || '—'}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1">
                                <StatusBadge label={lead.lead_source} dot={false} className="px-1.5 py-0.5 text-[9.5px]" />
                                {lead.trial_status && lead.trial_status !== 'none' && (
                                  <StatusBadge label={`trial ${lead.trial_status}`} dot={false} className="px-1.5 py-0.5 text-[9.5px]" />
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-between border-t pt-2 text-[10px] text-muted-foreground">
                                <span className="truncate">{lead.assigned_to || 'Unassigned'}</span>
                                <span className={cn('flex items-center gap-1', isOverdue(lead.follow_up_date) && 'text-rose-600')}>
                                  <CalendarClock className="h-3 w-3" />{lead.follow_up_date ? fmtDate(lead.follow_up_date) : '—'}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {col.cards.length === 0 && (
                        <p className="grid place-items-center py-6 text-[11px] text-muted-foreground/70">Drop cards here</p>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      <div className="flex items-center gap-2 rounded-xl border bg-card px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" />
        Stage moves never change product access — subscriptions and trials are only activated by verified payments or an admin action.
      </div>

      <LeadDetail
        lead={detail}
        open={Boolean(detail)}
        onOpenChange={(v) => !v && setDetail(null)}
        onEdit={(l) => { setDetail(null); setDialog({ open: true, lead: l }); }}
        onDelete={async (l) => { await ttcDataClient.entities.TTCLead.delete(l.id); setDetail(null); reload(); }}
        onPatch={patchLead}
      />
      <LeadDialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} lead={dialog.lead} teamNames={teamNames} onSaved={reload} />
    </div>
  );
}