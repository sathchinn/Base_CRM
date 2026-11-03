import { ttcDataClient } from '@/api/ttcDataClient';

/**
 * Runs every enabled automation matching a trigger.
 * Creates the conversation + automated message and an execution log.
 */
export async function runTrigger(trigger, context = {}) {
  let automations = [];
  try {
    const page = await ttcDataClient.entities.TTCAutomation.list({ sort: 'created_date', limit: 50 });
    automations = (page?.items || []).filter((a) => a.enabled && a.trigger === trigger);
  } catch {
    return [];
  }

  const runs = [];
  for (const automation of automations) {
    try {
      let conversationId = context.conversation_id;
      if (!conversationId && context.whatsapp_number) {
        const conversation = await ttcDataClient.entities.TTCConversation.create({
          customer_name: context.name || 'New customer',
          whatsapp_number: context.whatsapp_number,
          customer_id: context.customer_id || '',
          last_message: automation.message_body,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          status: 'open',
          assigned_to: '',
          automation_paused: false,
        });
        conversationId = conversation.id;
      }
      if (conversationId) {
        await ttcDataClient.entities.TTCWhatsAppMessage.create({
          conversation_id: conversationId,
          direction: 'outbound',
          category: 'automated',
          body: automation.message_body,
          status: 'sent',
          sent_by: `Automation · ${automation.name}`,
          sent_at: new Date().toISOString(),
        });
      }
      const run = await ttcDataClient.entities.TTCAutomationRun.create({
        automation_id: automation.id,
        automation_name: automation.name,
        trigger_event: trigger,
        status: 'success',
        detail: context.name ? `Sent to ${context.name}` : 'Trigger executed',
        target: context.whatsapp_number || '',
        run_at: new Date().toISOString(),
      });
      await ttcDataClient.entities.TTCAutomation.update(automation.id, {
        run_count: Number(automation.run_count || 0) + 1,
        last_run_at: new Date().toISOString(),
      });
      runs.push(run);
    } catch (error) {
      await ttcDataClient.entities.TTCAutomationRun.create({
        automation_id: automation.id,
        automation_name: automation.name,
        trigger_event: trigger,
        status: 'failed',
        detail: error?.message || 'Execution failed',
        run_at: new Date().toISOString(),
      });
    }
  }
  return runs;
}

export async function logAudit(action, entityType, recordId, summary, actor) {
  try {
    await ttcDataClient.entities.TTCAuditLog.create({
      action,
      entity_type: entityType,
      record_id: recordId || '',
      summary,
      actor: actor || 'Team',
      at: new Date().toISOString(),
    });
  } catch {
    /* audit logging never blocks the business action */
  }
}