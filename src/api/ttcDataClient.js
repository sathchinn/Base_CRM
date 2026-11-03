import { requireSupabase } from './supabaseClient';

const unsupported = (module) => new Error(`${module} is not yet backed by the current TTC database. No data was written. This module needs its own reviewed database schema before it can be enabled.`);
const one = (value) => (Array.isArray(value) ? value[0] : value);
const sortRows = (rows, sort) => {
  if (!sort) return rows;
  const desc = String(sort).startsWith('-');
  const field = desc ? String(sort).slice(1) : String(sort);
  return [...rows].sort((a, b) => {
    const av = a[field] == null ? '' : a[field];
    const bv = b[field] == null ? '' : b[field];
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return desc ? -cmp : cmp;
  });
};
const page = (items) => ({ items });

async function loadCustomerMeta() {
  const { data, error } = await requireSupabase().from('app_setting').select('value').eq('key', 'ttc_customer_meta').maybeSingle();
  if (error) throw error;
  return data?.value && typeof data.value === 'object' ? data.value : {};
}

async function saveCustomerMeta(meta) {
  const { error } = await requireSupabase().from('app_setting').upsert({ key: 'ttc_customer_meta', value: meta, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function loadCustomers() {
  const db = requireSupabase();
  const [
    { data: people, error: peopleError },
    { data: profiles, error: profilesError },
    { data: identifiers, error: identifiersError },
    customerMeta,
  ] = await Promise.all([
    db.from('v_people').select('*').order('first_seen_at', { ascending: false }),
    db.from('person').select('person_id, profile_name, status'),
    db.from('identifier').select('person_id, type, value_norm'),
    loadCustomerMeta(),
  ]);
  if (peopleError) throw peopleError;
  if (profilesError) throw profilesError;
  if (identifiersError) throw identifiersError;
  const profileById = new Map((profiles || []).map((p) => [p.person_id, p]));
  const identifiersById = new Map();
  (identifiers || []).forEach((item) => {
    const group = identifiersById.get(item.person_id) || {};
    if (item.type === 'whatsapp') group.whatsapp = item.value_norm;
    if (item.type === 'tv_username') group.tradingview_username = item.value_norm;
    if (item.type === 'email') group.email = item.value_norm;
    identifiersById.set(item.person_id, group);
  });
  return (people || []).map((p) => {
    const profile = profileById.get(p.person_id) || {};
    const identifiersForPerson = identifiersById.get(p.person_id) || {};
    const meta = customerMeta[p.person_id] || {};
    return {
      id: p.person_id, person_id: p.person_id, name: profile.profile_name || identifiersForPerson.whatsapp || 'Unknown customer',
      whatsapp_number: p.whatsapp || identifiersForPerson.whatsapp || '',
      tradingview_username: p.tv_username || identifiersForPerson.tradingview_username || '',
      email: identifiersForPerson.email || '', previous_usernames: meta.previous_usernames || [],
      lead_source: meta.lead_source || (p.first_ad_id ? 'WhatsApp' : 'Direct'),
      assigned_to: meta.assigned_to || '', status: profile.status || p.person_status || 'active',
      joined_date: p.first_seen_at || p.granted_at, created_date: p.first_seen_at || p.granted_at,
      notes: meta.notes || '', duplicate_trial_flag: Boolean(meta.duplicate_trial_flag),
      trial_status: p.lifecycle_status || 'none', trial_start_date: p.start_date,
      trial_expiry_date: p.end_date, access_status: p.access_status, lead_id: null,
    };
  });
}

async function loadPipelineMeta() {
  const { data, error } = await requireSupabase().from('app_setting').select('value').eq('key', 'ttc_lead_pipeline').maybeSingle();
  if (error) throw error;
  return data?.value && typeof data.value === 'object' ? data.value : {};
}

async function savePipelineMeta(meta) {
  const { error } = await requireSupabase().from('app_setting').upsert({ key: 'ttc_lead_pipeline', value: meta, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function loadLeads() {
  const db = requireSupabase();
  const [{ data: leads, error }, customers, pipelineMeta] = await Promise.all([
    db.from('lead').select('*').order('created_at', { ascending: false }).limit(1000),
    loadCustomers(), loadPipelineMeta(),
  ]);
  if (error) throw error;
  const byPerson = new Map(customers.map((c) => [c.person_id, c]));
  return (leads || []).map((l) => {
    const c = byPerson.get(l.person_id) || {};
    const meta = pipelineMeta[l.person_id] || {};
    return {
      id: l.person_id, lead_id: l.lead_id, person_id: l.person_id, customer_id: l.person_id,
      name: c.name || 'WhatsApp lead', whatsapp_number: c.whatsapp_number || '',
      tradingview_username: c.tradingview_username || '', email: c.email || '',
      status: meta.status || (c.trial_status === 'active' ? 'trial_active' : 'new'),
      assigned_to: meta.assigned_to || '', lead_date: l.created_at, created_date: l.created_at,
      last_contacted: meta.last_contacted || null, follow_up_date: meta.follow_up_date || null, notes: meta.notes || '', trial_status: c.trial_status || 'none',
      subscription_status: 'unknown', stage_history: meta.stage_history || [], is_duplicate: Boolean(meta.is_duplicate), duplicate_note: meta.duplicate_note || '',
      lead_source: meta.lead_source || (l.ad_id || l.ctwa_clid ? 'WhatsApp' : (c.whatsapp_number ? 'WhatsApp' : 'Direct')),
      post_url: meta.post_url || '', trading_session: meta.trading_session || '', campaign: meta.campaign || l.ad_id || '',
    };
  });
}

async function loadConversations() {
  const db = requireSupabase();
  const { data, error } = await db.from('v_inbox_plus').select('*').eq('has_whatsapp', true).order('last_message_at', { ascending: false, nullsFirst: false }).limit(1000);
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.person_id, person_id: c.person_id, customer_id: c.person_id,
    customer_name: c.profile_name || c.whatsapp || c.channel_handle || 'Unknown contact',
    whatsapp_number: c.whatsapp || '', last_message: c.last_body || '',
    last_message_at: c.last_message_at, unread_count: c.unread ? 1 : 0,
    status: 'open', assigned_to: '', automation_paused: Boolean(c.automation_paused),
    automation_paused_until: c.automation_paused_until, trial_status: c.lifecycle_status || '',
    subscription_status: '', opted_out: false, channel: c.channel,
  }));
}

async function loadMessages(personId) {
  const db = requireSupabase();
  const [{ data, error }, { data: templates, error: templateError }] = await Promise.all([
    db.from('message').select('*').eq('person_id', personId).order('created_at', { ascending: true }).limit(500),
    db.from('msg_template').select('template_id, name, wa_template_name, message_role'),
  ]);
  if (error) throw error;
  if (templateError) throw templateError;
  const templateById = new Map((templates || []).map((t) => [t.template_id, t]));
  return (data || []).map((m) => ({
    _template: m.template_id ? templateById.get(m.template_id) : null,
    id: m.message_id, message_id: m.message_id, conversation_id: m.person_id,
    direction: m.direction === 'out' ? 'outbound' : 'inbound',
    category: m.source === 'system' ? 'system' : (m.template_id ? 'template' : (m.source === 'automation' ? 'automated' : 'text')),
    body: m.body || '', template_name: (m.template_id ? templateById.get(m.template_id)?.name || templateById.get(m.template_id)?.wa_template_name : '') || '',
    buttons: m.payload?.buttons || [], status: m.status, error_message: m.error || '',
    sent_by: m.source, sent_at: m.created_at, created_date: m.created_at,
  }));
}

async function loadTrials() {
  const db = requireSupabase();
  const [{ data, error }, customers] = await Promise.all([
    db.from('trial').select('*').order('created_at', { ascending: false }), loadCustomers(),
  ]);
  if (error) throw error;
  const byPerson = new Map(customers.map((c) => [c.person_id, c]));
  return (data || []).map((t) => {
    const c = byPerson.get(t.person_id) || {};
    const status = t.access_status === 'granted' ? 'trial' : t.access_status === 'removed' ? 'expired' : t.access_status === 'removal_pending' ? 'suspended' : 'pending_payment';
    return {
      id: t.trial_id, trial_id: t.trial_id, customer_id: t.person_id, customer_name: c.name || 'Unknown customer',
      product_id: '', product_name: 'TTC Trial Access', plan_type: 'trial', price: 0, currency: 'INR',
      start_date: t.start_date, expiry_date: t.end_date, renewal_date: t.end_date,
      payment_reference: '', status, access_status: t.access_status, access_granted: t.access_status === 'granted',
      auto_renew: false, notes: t.review_reason || '', tradingview_username: t.tv_username_norm,
      created_date: t.created_at,
    };
  });
}

async function loadAutomations() {
  const db = requireSupabase();
  const [{ data, error }, { data: templates, error: templateError }] = await Promise.all([
    db.from('automation').select('*').order('priority', { ascending: true }),
    db.from('msg_template').select('template_id, name, body, wa_template_name'),
  ]);
  if (error) throw error;
  if (templateError) throw templateError;
  const templateById = new Map((templates || []).map((t) => [t.template_id, t]));
  return (data || []).map((a) => {
    const actions = Array.isArray(a.actions) ? a.actions : [];
    const sendAction = actions.find((x) => x && typeof x === 'object' && x.type === 'send');
    const template = sendAction?.template_id ? templateById.get(sendAction.template_id) : null;
    return {
      id: a.automation_id, automation_id: a.automation_id, name: a.name,
      category: 'WhatsApp', trigger: a.trigger_type, keywords: a.trigger_value ? [a.trigger_value] : [],
      conditions: a.match_mode, message_body: template?.body || template?.wa_template_name || '',
      enabled: a.enabled, run_count: 0, failure_count: 0, last_run_at: a.updated_at,
      created_date: a.created_at, _raw: a,
    };
  });
}

async function loadMessageTemplates() {
  const { data, error } = await requireSupabase().from('msg_template').select('*').order('name');
  if (error) throw error;
  return (data || []).map((t) => ({ id: t.template_id, template_id: t.template_id, name: t.name, kind: t.kind, body: t.body || '', wa_template_name: t.wa_template_name || '', message_role: t.message_role || (t.system_key ? 'system' : 'normal'), system_key: t.system_key, buttons: t.buttons || [], wa_language: t.wa_language || 'en' }));
}

async function loadAutomationRuns() {
  const db = requireSupabase();
  const { data, error } = await db.from('v_automation_event').select('*').order('created_at', { ascending: false }).limit(250);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.event_id, automation_id: r.automation_id, automation_name: r.automation_name || 'Automation',
    trigger_event: r.action_type, status: r.outcome === 'ok' ? 'success' : r.outcome,
    detail: r.error || r.trigger_ref || '', target: r.profile_name || '', run_at: r.created_at,
  }));
}

async function loadSettings() {
  const db = requireSupabase();
  const { data, error } = await db.from('app_setting').select('*');
  if (error) throw error;
  const current = (data || []).find((r) => r.key === 'ttc_crm_settings')?.value || {};
  return [{ id: 'ttc-settings', ...current, created_date: null, updated_date: (data || []).find((r) => r.key === 'ttc_crm_settings')?.updated_at }];
}

async function loadAudit() {
  const db = requireSupabase();
  const { data, error } = await db.from('v_automation_event').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.event_id, action: r.action_type, entity_type: 'Automation', record_id: r.person_id, summary: `${r.automation_name || 'Automation'} · ${r.outcome}${r.error ? ` · ${r.error}` : ''}`, actor: 'System', at: r.created_at }));
}

async function loadTeam() {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  const u = data.user;
  return u ? [{ id: u.id, name: u.user_metadata?.full_name || u.email, email: u.email, role: 'super_admin', status: 'active', permissions: ['all'], last_active: u.last_sign_in_at || u.created_at }] : [];
}

async function loadNotifications() {
  const db = requireSupabase();
  const [{ data: inbox, error: inboxError }, { data: trials, error: trialError }, { data: queue, error: queueError }] = await Promise.all([
    db.from('v_inbox_plus').select('person_id, profile_name, unread').eq('unread', true).limit(30),
    db.from('trial').select('trial_id, person_id, end_date, access_status').eq('access_status', 'granted').limit(100),
    db.from('v_scheduled_send').select('id, profile_name, status, last_error').eq('status', 'failed').limit(20),
  ]);
  if (inboxError) throw inboxError;
  if (trialError) throw trialError;
  if (queueError) throw queueError;
  const items = [];
  (inbox || []).forEach((r) => items.push({ id: `unread-${r.person_id}`, title: 'Unread WhatsApp message', body: r.profile_name || 'Customer conversation', type: 'message', link: '/whatsapp', is_read: false, created_date: new Date().toISOString() }));
  (trials || []).filter((r) => r.end_date && new Date(r.end_date).getTime() - Date.now() < 3 * 86400000 && new Date(r.end_date).getTime() > Date.now()).forEach((r) => items.push({ id: `trial-${r.trial_id}`, title: 'Trial expiring soon', body: `Trial expires ${r.end_date}`, type: 'trial', link: '/subscriptions', is_read: false, created_date: r.end_date }));
  (queue || []).forEach((r) => items.push({ id: `send-${r.id}`, title: 'Scheduled message failed', body: r.last_error || r.profile_name || 'Review the send queue', type: 'error', link: '/automation', is_read: false, created_date: new Date().toISOString() }));
  return items;
}

const readers = {
  TTCCustomer: loadCustomers,
  TTCLead: loadLeads,
  TTCConversation: loadConversations,
  TTCSubscription: loadTrials,
  TTCAutomation: loadAutomations,
  TTCAutomationRun: loadAutomationRuns,
  TTCMessageTemplate: loadMessageTemplates,
  TTCSetting: loadSettings,
  TTCAuditLog: loadAudit,
  TTCTeamMember: loadTeam,
  TTCNotification: loadNotifications,
  TTCWhatsAppMessage: async () => [],
  TTCBooking: async () => [],
  TTCTransaction: async () => [],
  TTCProduct: async () => [],
  TTCTradingViewPost: async () => [],
  TTCTradingViewInteraction: async () => [],
};

async function listEntity(name, options = {}) {
  const reader = readers[name];
  if (!reader) throw unsupported(name);
  const items = sortRows(await reader(), options.sort).slice(0, options.limit || 500);
  return page(items);
}

async function filterEntity(name, filters = {}, options = {}) {
  if (name === 'TTCWhatsAppMessage') {
    const items = await loadMessages(filters.conversation_id);
    return page(sortRows(items, options.sort).slice(0, options.limit || 200));
  }
  const result = await listEntity(name, options);
  const items = result.items.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
  return page(items);
}

async function updateEntity(name, id, patch) {
  const db = requireSupabase();
  if (name === 'TTCConversation') {
    if (Object.prototype.hasOwnProperty.call(patch, 'unread_count')) {
      const { error } = await db.from('conversation').update({ unread: Number(patch.unread_count) > 0 }).eq('person_id', id);
      if (error) throw error;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'automation_paused')) {
      const { error } = await db.from('conversation').update({ automation_paused_until: patch.automation_paused ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null }).eq('person_id', id);
      if (error) throw error;
    }
    return (await loadConversations()).find((r) => r.id === id);
  }
  if (name === 'TTCAutomation') {
    const allowed = {};
    if (typeof patch.enabled === 'boolean') allowed.enabled = patch.enabled;
    if (patch.name) allowed.name = patch.name;
    if (patch.trigger && ['first_message', 'keyword', 'button', 'ad_click', 'default'].includes(patch.trigger)) allowed.trigger_type = patch.trigger;
    if (patch.conditions && ['exact', 'contains'].includes(patch.conditions)) allowed.match_mode = patch.conditions;
    if (!Object.keys(allowed).length) throw unsupported('Automation editing beyond enable/disable');
    const { error } = await db.from('automation').update(allowed).eq('automation_id', id);
    if (error) throw error;
    return (await loadAutomations()).find((r) => r.id === id);
  }
  if (name === 'TTCSetting') {
    const { data: existing, error: readError } = await db.from('app_setting').select('value').eq('key', 'ttc_crm_settings').maybeSingle();
    if (readError) throw readError;
    const { error } = await db.from('app_setting').upsert({ key: 'ttc_crm_settings', value: { ...(existing?.value || {}), ...patch }, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { id: 'ttc-settings', ...(existing?.value || {}), ...patch };
  }
  if (name === 'TTCLead') {
    if (patch.name) {
      const { error: nameError } = await db.from('person').update({ profile_name: patch.name }).eq('person_id', id);
      if (nameError) throw nameError;
    }
    if (patch.whatsapp_number) {
      const { data: currentIdentifier, error: identifierError } = await db.from('identifier').select('value_norm').eq('person_id', id).eq('type', 'whatsapp').maybeSingle();
      if (identifierError) throw identifierError;
      const normalizedPhone = String(patch.whatsapp_number).replace(/\D/g, '');
      if (normalizedPhone && normalizedPhone !== currentIdentifier?.value_norm) {
        const { error: phoneError } = await db.rpc('link_whatsapp_number', { p_person_id: id, p_whatsapp: patch.whatsapp_number });
        if (phoneError) throw phoneError;
      }
    }
    const current = await loadPipelineMeta();
    const existing = current[id] || {};
    const allowed = ['status', 'assigned_to', 'last_contacted', 'follow_up_date', 'notes', 'stage_history', 'is_duplicate', 'duplicate_note', 'lead_source', 'post_url', 'trading_session', 'campaign'];
    const next = { ...existing };
    allowed.forEach((key) => { if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key]; });
    current[id] = next;
    await savePipelineMeta(current);
    return (await loadLeads()).find((r) => r.id === id);
  }
  if (name === 'TTCCustomer') {
    if (patch.name) {
      const { error } = await db.from('person').update({ profile_name: patch.name }).eq('person_id', id);
      if (error) throw error;
    }
    if (patch.whatsapp_number) {
      const { data: currentIdentifier, error: identifierError } = await db.from('identifier').select('value_norm').eq('person_id', id).eq('type', 'whatsapp').maybeSingle();
      if (identifierError) throw identifierError;
      const normalizedPhone = String(patch.whatsapp_number).replace(/\D/g, '');
      if (normalizedPhone && normalizedPhone !== currentIdentifier?.value_norm) {
        const { error } = await db.rpc('link_whatsapp_number', { p_person_id: id, p_whatsapp: patch.whatsapp_number });
        if (error) throw error;
      }
    }
    const meta = await loadCustomerMeta();
    const existing = meta[id] || {};
    const fields = ['previous_usernames', 'lead_source', 'assigned_to', 'notes', 'duplicate_trial_flag'];
    const next = { ...existing };
    fields.forEach((key) => { if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key]; });
    meta[id] = next;
    await saveCustomerMeta(meta);
    return (await loadCustomers()).find((r) => r.id === id);
  }
  throw unsupported(name);
}

async function createEntity(name, payload) {
  const db = requireSupabase();
  if (name === 'TTCLead') {
    if (!payload.whatsapp_number) throw new Error('A WhatsApp number is required to register a lead in the current TTC database.');
    const { data, error } = await db.rpc('register_lead', { p_whatsapp: payload.whatsapp_number, p_ad_id: null, p_ctwa_clid: null });
    if (error) throw error;
    if (data?.result && data.result !== 'ok') throw new Error(data.result === 'invalid_number' ? 'Enter a valid WhatsApp number.' : `Lead registration failed: ${data.result}`);
    const personId = data?.person_id || data?.person?.person_id || data?.id;
    if (personId && payload.name) {
      const { error: nameError } = await db.from('person').update({ profile_name: payload.name }).eq('person_id', personId);
      if (nameError) throw nameError;
    }
    if (personId) {
      const current = await loadPipelineMeta();
      current[personId] = { ...(current[personId] || {}), lead_source: payload.lead_source || 'Direct', post_url: payload.post_url || '', trading_session: payload.trading_session || '', campaign: payload.campaign || '', notes: payload.notes || '', status: payload.status || 'new' };
      await savePipelineMeta(current);
    }
    return { ...data, id: personId || data?.person_id };
  }
  if (name === 'TTCCustomer' || name === 'TTCConversation') {
    if (!payload.whatsapp_number) throw new Error('A WhatsApp number is required.');
    const { data, error } = await db.rpc('register_lead', { p_whatsapp: payload.whatsapp_number, p_ad_id: null, p_ctwa_clid: null });
    if (error) throw error;
    if (data?.result && data.result !== 'ok') throw new Error(data.result === 'invalid_number' ? 'Enter a valid WhatsApp number.' : `Contact registration failed: ${data.result}`);
    if (data?.person_id && (payload.name || payload.customer_name)) {
      const { error: nameError } = await db.from('person').update({ profile_name: payload.name || payload.customer_name }).eq('person_id', data.person_id);
      if (nameError) throw nameError;
    }
    if (data?.person_id) {
      const meta = await loadCustomerMeta();
      meta[data.person_id] = { ...(meta[data.person_id] || {}), lead_source: payload.lead_source || 'WhatsApp', assigned_to: payload.assigned_to || '', notes: payload.notes || '' };
      await saveCustomerMeta(meta);
    }
    return { ...data, id: data?.person_id };
  }
  if (name === 'TTCWhatsAppMessage') {
    const personId = payload.conversation_id;
    if (payload.category === 'template' && payload.template_name) {
      const { data: template, error: templateError } = await db.from('msg_template').select('template_id, kind, body, wa_template_name').or(`name.eq.${payload.template_name},wa_template_name.eq.${payload.template_name}`).limit(1).maybeSingle();
      if (templateError) throw templateError;
      if (!template) throw new Error('The selected message was not found in the TTC message library.');
      const request = template.kind === 'wa_template'
        ? { action: 'send_template', person_id: personId, template_id: template.template_id }
        : { action: 'reply_text', person_id: personId, text: template.body || payload.body };
      const { data, error } = await db.functions.invoke('whatsapp-webhook/send', { body: request });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || 'WhatsApp send failed.');
      return data;
    }
    const { data, error } = await db.functions.invoke('whatsapp-webhook/send', { body: { action: 'reply_text', person_id: personId, text: payload.body } });
    if (error) throw error;
    if (data?.ok === false) throw new Error(data.error || 'WhatsApp send failed.');
    return data;
  }
  throw unsupported(name);
}

async function deleteEntity(name, id) {
  if (name === 'TTCAutomation') {
    const { error } = await requireSupabase().from('automation').delete().eq('automation_id', id);
    if (error) throw error;
    return true;
  }
  throw unsupported(name);
}

const entities = new Proxy({}, {
  get(_target, name) {
    return {
      list: (options) => listEntity(name, options),
      filter: (filters, options) => filterEntity(name, filters, options),
      create: (payload) => createEntity(name, payload),
      update: (id, patch) => updateEntity(name, id, patch),
      delete: (id) => deleteEntity(name, id),
      updateMany: async () => { throw unsupported(`${String(name)} bulk update`); },
      subscribe: (callback) => {
        const channel = requireSupabase().channel(`ttc-supabase-${String(name)}-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: name === 'TTCWhatsAppMessage' ? 'message' : 'conversation' }, (payload) => callback({ data: payload.new || payload.old }));
        channel.subscribe();
        return () => requireSupabase().removeChannel(channel);
      },
    };
  },
});

export const ttcDataClient = {
  entities,
  auth: {
    me: async () => {
      const { data, error } = await requireSupabase().auth.getUser();
      if (error) throw error;
      return data.user;
    },
    logout: async () => requireSupabase().auth.signOut(),
    redirectToLogin: () => window.location.assign('/login'),
  },
  functions: {
    invoke: async () => { throw unsupported('Payment gateway functions'); },
  },
};
