import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck, Webhook, MessageCircle, Database } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Panel from '@/components/ttc/Panel';
import { cn } from '@/lib/utils';

const DEFAULT = {
  business_name: 'Thanks To Chart',
  support_whatsapp: '',
  support_email: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  trial_days: 3,
  payment_mode: 'test',
  renewal_reminder_days: 3,
  follow_up_reminder_hours: 24,
  automation_enabled: true,
};

export default function Settings() {
  const { items, loading, reload } = useRecords('TTCSetting', 'created_date');
  const setting = items[0];
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (setting) setForm({ ...DEFAULT, ...setting });
  }, [setting?.id, setting?.updated_date]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        trial_days: Number(form.trial_days || 3),
        renewal_reminder_days: Number(form.renewal_reminder_days || 3),
        follow_up_reminder_hours: Number(form.follow_up_reminder_hours || 24),
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      if (setting) await ttcDataClient.entities.TTCSetting.update(setting.id, payload);
      else await ttcDataClient.entities.TTCSetting.create(payload);
      await ttcDataClient.entities.TTCAuditLog.create({
        action: 'settings_updated',
        entity_type: 'TTCSetting',
        summary: 'Business settings updated',
        actor: 'Admin',
        at: new Date().toISOString(),
      });
      setSaved(true);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Workspace</p>
        <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Settings</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">Business defaults, payment mode and channel configuration.</p>
      </header>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <form onSubmit={save} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Panel title="Business profile" subtitle="Used across receipts, reminders and reports" bodyClassName="p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Business name</Label><Input value={form.business_name} onChange={set('business_name')} /></div>
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Support WhatsApp</Label><Input value={form.support_whatsapp} onChange={set('support_whatsapp')} placeholder="91XXXXXXXXXX" /></div>
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Support email</Label><Input value={form.support_email} onChange={set('support_email')} placeholder="support@thankstochart.com" /></div>
                <div>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">Default currency</Label>
                  <select value={form.currency} onChange={set('currency')} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                    {['INR', 'USD', 'EUR', 'AED'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Timezone</Label><Input value={form.timezone} onChange={set('timezone')} /></div>
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Default trial length (days)</Label><Input type="number" min="0" value={form.trial_days} onChange={set('trial_days')} /></div>
              </div>
            </Panel>

            <Panel title="Reminders & automation" subtitle="Defaults applied to new workflows" bodyClassName="p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Renewal reminder (days before)</Label><Input type="number" min="0" value={form.renewal_reminder_days} onChange={set('renewal_reminder_days')} /></div>
                <div><Label className="mb-1 block text-[11px] text-muted-foreground">Follow-up reminder (hours)</Label><Input type="number" min="0" value={form.follow_up_reminder_hours} onChange={set('follow_up_reminder_hours')} /></div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={Boolean(form.automation_enabled)}
                  onChange={(e) => setForm((f) => ({ ...f, automation_enabled: e.target.checked }))}
                />
                Run WhatsApp automations globally
              </label>
            </Panel>

            <Panel title="Payments" subtitle="Gateways stay in test mode until credentials and webhooks are verified" bodyClassName="p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-[11px] text-muted-foreground">Payment mode</Label>
                  <select value={form.payment_mode} onChange={set('payment_mode')} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current mode</p>
                  <p className={cn('text-[13px] font-medium capitalize', form.payment_mode === 'live' ? 'text-emerald-600' : 'text-amber-600')}>{form.payment_mode}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-[11.5px] text-muted-foreground">
                <p className="flex items-start gap-2"><Webhook className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Razorpay · Cashfree · Stripe webhooks are verified server-side with an HMAC signature and processed idempotently by event ID.</p>
                <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Add <span className="font-mono">RAZORPAY_WEBHOOK_SECRET</span>, <span className="font-mono">CASHFREE_WEBHOOK_SECRET</span> or <span className="font-mono">STRIPE_WEBHOOK_SECRET</span> on the dashboard Secrets page before switching to live.</p>
                <p className="flex items-start gap-2"><Database className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Manual records stay available for bank transfers and UPI settlements, always with an audit trail.</p>
              </div>
            </Panel>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save settings
              </Button>
              {saved && <span className="text-[12px] text-emerald-600">Settings saved</span>}
            </div>
          </div>

          <div className="space-y-4">
            <Panel title="Channels" subtitle="Connection status" bodyClassName="p-5">
              <ul className="space-y-3 text-[11.5px]">
                <li className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block font-medium text-foreground">WhatsApp inbox</span>
                    <span className="text-muted-foreground">Threads, templates and automations run inside the CRM. Live delivery and read receipts begin once a WhatsApp Business number is connected.</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Webhook className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block font-medium text-foreground">TradingView</span>
                    <span className="text-muted-foreground">Posts, boosts and comment-to-lead tracking are recorded manually — no automatic TradingView access is assumed.</span>
                  </span>
                </li>
              </ul>
            </Panel>

            <Panel title="Data connection" subtitle="Live TTC Supabase workspace" bodyClassName="p-5">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Customer, lead, trial, WhatsApp conversation, message and automation records are read from the connected TTC database.
                Payment, booking, product catalogue and TradingView post-management records are not present in the current database schema;
                those screens remain unavailable until their data model and permissions are approved. No demo transactions are included.
              </p>
            </Panel>
          </div>
        </form>
      )}
    </div>
  );
}