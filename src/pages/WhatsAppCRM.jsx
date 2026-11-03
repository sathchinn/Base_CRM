import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, Loader2, CheckCheck, AlertCircle, Bot, Hand, MessageSquare, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/ttc/StatusBadge';
import { fmtDateTime, fmtTime, fmtMoney, normalizePhone } from '@/lib/ttc';
import { cn } from '@/lib/utils';



export default function WhatsAppCRM() {
  const { items: conversations, reload: reloadConversations } = useRecords('TTCConversation', '-last_message_at');
  const { items: customers } = useRecords('TTCCustomer');
  const { items: subscriptions } = useRecords('TTCSubscription');
  const { items: transactions } = useRecords('TTCTransaction');
  const { items: automations } = useRecords('TTCAutomation');
  const { items: messageTemplates } = useRecords('TTCMessageTemplate');

  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const bottomRef = useRef(null);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (unreadOnly && !c.unread_count) return false;
      if (!term) return true;
      return [c.customer_name, c.whatsapp_number, c.last_message].join(' ').toLowerCase().includes(term);
    });
  }, [conversations, search, unreadOnly]);

  useEffect(() => {
    if (!selectedId && filtered.length) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const loadMessages = async (id) => {
    if (!id) return;
    setLoadingMessages(true);
    try {
      const page = await ttcDataClient.entities.TTCWhatsAppMessage.filter({ conversation_id: id }, { sort: 'sent_at', limit: 200 });
      setMessages(page?.items || []);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const unsubscribe = ttcDataClient.entities.TTCWhatsAppMessage.subscribe((event) => {
      if (event.data?.conversation_id === selectedId) loadMessages(selectedId);
    });
    return unsubscribe;
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const customer = selected
    ? customers.find((c) => normalizePhone(c.whatsapp_number) === normalizePhone(selected.whatsapp_number))
    : null;
  const customerSubs = customer ? subscriptions.filter((s) => s.customer_name === customer.name) : [];
  const customerTxns = customer ? transactions.filter((t) => t.customer_name === customer.name) : [];

  const markRead = async () => {
    if (!selected || !selected.unread_count) return;
    await ttcDataClient.entities.TTCConversation.update(selected.id, { unread_count: 0 });
    reloadConversations();
  };

  const send = async (body, templateName) => {
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      await ttcDataClient.entities.TTCWhatsAppMessage.create({
        conversation_id: selected.id,
        direction: 'outbound',
        category: templateName ? 'template' : 'text',
        template_name: templateName || '',
        body: body.trim(),
        status: 'sent',
        sent_by: 'Agent',
        sent_at: new Date().toISOString(),
      });
      await ttcDataClient.entities.TTCConversation.update(selected.id, {
        last_message: body.trim(),
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        automation_paused: selected.automation_paused ?? true,
      });
      setDraft('');
      setShowTemplates(false);
      await loadMessages(selected.id);
      reloadConversations();
    } finally {
      setSending(false);
    }
  };

  const toggleAutomation = async () => {
    if (!selected) return;
    await ttcDataClient.entities.TTCConversation.update(selected.id, { automation_paused: !selected.automation_paused });
    reloadConversations();
  };

  const activeAutomations = automations.filter((a) => a.enabled).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Conversations · {conversations.length} threads</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">WhatsApp CRM</h1>
        </div>
        <p className="max-w-sm text-[11.5px] leading-relaxed text-muted-foreground">
          {activeAutomations} automations active. Sending a manual reply pauses automation on that thread until you resume it.
          Delivery and read receipts appear once the WhatsApp Business channel is connected.
        </p>
      </header>

      <div className="panel grid h-[calc(100vh-13rem)] min-h-[520px] grid-cols-1 overflow-hidden lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_310px]">
        <aside className="flex min-h-0 flex-col border-r">
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className="h-8 pl-8 text-[12.5px]" />
            </div>
            <button
              type="button"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={cn(
                'w-full rounded-lg border px-2 py-1 text-[11px] transition-colors',
                unreadOnly ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {unreadOnly ? 'Showing unread only' : 'Filter unread conversations'}
            </button>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-colors',
                  selectedId === c.id ? 'bg-muted' : 'hover:bg-muted/50'
                )}
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                  {(c.customer_name || '?').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium">{c.customer_name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[9.5px] text-muted-foreground">{fmtTime(c.last_message_at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1">
                    <span className="truncate text-[11px] text-muted-foreground">{c.last_message || 'No messages yet'}</span>
                    {c.unread_count > 0 && (
                      <span className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-foreground">
                        {c.unread_count}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-10 text-center text-[12px] text-muted-foreground">No conversations</p>}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-muted/20">
          {!selected ? (
            <div className="grid flex-1 place-items-center text-[12.5px] text-muted-foreground">Select a conversation</div>
          ) : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{selected.customer_name}</p>
                  <p className="font-mono text-[10.5px] text-muted-foreground">{selected.whatsapp_number}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <StatusBadge label={selected.automation_paused ? 'automation paused' : 'automation on'} tone={selected.automation_paused ? 'warning' : 'success'} />
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={markRead}>
                    <CheckCheck className="mr-1 h-3 w-3" /> Mark read
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={toggleAutomation}>
                    {selected.automation_paused ? <Bot className="mr-1 h-3 w-3" /> : <Hand className="mr-1 h-3 w-3" />}
                    {selected.automation_paused ? 'Resume bot' : 'Take over'}
                  </Button>
                </div>
              </header>

              <div className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
                {loadingMessages && <div className="grid place-items-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                {!loadingMessages && messages.length === 0 && (
                  <p className="py-10 text-center text-[12px] text-muted-foreground">No messages in this thread yet.</p>
                )}
                {messages.map((m) => {
                  const outbound = m.direction === 'outbound';
                  if (m.category === 'system') {
                    return (
                      <div key={m.id} className="mx-auto max-w-md rounded-lg bg-card px-3 py-1.5 text-center text-[10.5px] text-muted-foreground ring-1 ring-border">
                        {m.body}
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[76%] rounded-2xl px-3 py-2 text-[12.5px] shadow-sm',
                          outbound
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm bg-card text-foreground ring-1 ring-border'
                        )}
                      >
                        {m.category === 'template' && (
                          <p className={cn('mb-1 font-mono text-[9px] uppercase tracking-wider', outbound ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            template · {m.template_name}
                          </p>
                        )}
                        {m.category === 'automated' && (
                          <p className={cn('mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider', outbound ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            <Bot className="h-2.5 w-2.5" /> automated
                          </p>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        {Array.isArray(m.buttons) && m.buttons.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {m.buttons.map((b) => (
                              <span key={b} className={cn('rounded-md px-2 py-0.5 text-[10.5px]', outbound ? 'bg-primary-foreground/15' : 'bg-muted')}>{b}</span>
                            ))}
                          </div>
                        )}
                        <p className={cn('mt-1 flex items-center justify-end gap-1 font-mono text-[9px]', outbound ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                          {fmtTime(m.sent_at)}
                          {outbound && m.status === 'failed' && <AlertCircle className="h-2.5 w-2.5 text-rose-300" />}
                          {outbound && m.status === 'read' && <CheckCheck className="h-2.5 w-2.5" />}
                          {outbound && m.status !== 'read' && m.status !== 'failed' && <CheckCheck className="h-2.5 w-2.5 opacity-50" />}
                        </p>
                        {m.error_message && <p className="mt-1 text-[10px] text-rose-200">{m.error_message}</p>}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {showTemplates && (
                <div className="border-t bg-card px-3 py-2">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Approved templates</p>
                  <div className="flex flex-wrap gap-1.5">
                    {messageTemplates.filter((t) => ['text', 'wa_template'].includes(t.kind)).map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => send((t.body || t.wa_template_name || '').replace('{{name}}', selected.customer_name.split(' ')[0]), t.name)}
                        className="rounded-lg border px-2 py-1 text-[11px] transition-colors hover:bg-muted"
                      >
                        {t.message_role === 'system' ? 'System · ' : 'Normal · '}{t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); send(draft); }}
                className="flex items-center gap-2 border-t bg-card p-2.5"
              >
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-muted-foreground', showTemplates && 'bg-muted text-foreground')}
                  title="Templates"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a reply…" className="h-9 text-[13px]" />
                <Button type="submit" size="sm" disabled={sending || !draft.trim()} className="h-9">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </section>

        <aside className="scroll-thin hidden min-h-0 overflow-y-auto border-l bg-card xl:block">
          {selected && (
            <div className="divide-y">
              <div className="p-4">
                <p className="eyebrow">Customer</p>
                <p className="mt-1.5 text-[14px] font-semibold">{selected.customer_name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{selected.whatsapp_number}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge label={customer?.status || 'lead'} />
                  {customer?.tradingview_username && <StatusBadge label={`@${customer.tradingview_username}`} dot={false} />}
                </div>
                {customer && (
                  <Link to="/customers" className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                    Open full profile <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              <div className="p-4">
                <p className="eyebrow">Subscriptions</p>
                {customerSubs.length === 0 && <p className="mt-1.5 text-[11.5px] text-muted-foreground">No subscription on record</p>}
                <ul className="mt-1.5 space-y-1.5">
                  {customerSubs.slice(0, 3).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="truncate">{s.product_name}</span>
                      <StatusBadge label={s.status} />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4">
                <p className="eyebrow">Payments</p>
                {customerTxns.length === 0 && <p className="mt-1.5 text-[11.5px] text-muted-foreground">No payments yet</p>}
                <ul className="mt-1.5 space-y-1.5">
                  {customerTxns.slice(0, 4).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{fmtDateTime(t.paid_at)}</span>
                      <span className="font-mono">{fmtMoney(t.amount, t.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4">
                <p className="eyebrow">Notes</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted-foreground">
                  {customer?.notes || 'No notes on this customer yet.'}
                </p>
              </div>

              <div className="p-4">
                <p className="eyebrow">Assigned agent</p>
                <p className="mt-1.5 text-[12px]">{selected.assigned_to || 'Unassigned'}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}