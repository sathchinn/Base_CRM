import { useState } from 'react';
import { Plus, Pencil, Loader2, ShieldCheck } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import Panel from '@/components/ttc/Panel';
import { PERMISSION_KEYS, TEAM_ROLES, fmtDateTime, titleCase } from '@/lib/ttc';
import { cn } from '@/lib/utils';
import SchemaNotice from '@/components/ttc/SchemaNotice';

const EMPTY = { name: '', email: '', phone: '', role: 'lead_manager', status: 'active', permissions: [] };

const ROLE_DEFAULTS = {
  super_admin: PERMISSION_KEYS,
  admin: PERMISSION_KEYS,
  lead_manager: ['Dashboard', 'Leads', 'Kanban', 'WhatsApp', 'Marketing', 'Bookings', 'Customers', 'Reports'],
  whatsapp_support: ['Dashboard', 'Leads', 'WhatsApp', 'Bookings', 'Customers'],
  trainer: ['Dashboard', 'Bookings', 'Customers', 'Marketing'],
  finance_manager: ['Dashboard', 'Customers', 'Subscriptions', 'Payments', 'Reports'],
};

export default function TeamManagement() {
  const { items: team, loading, reload } = useRecords('TTCTeamMember', 'created_date');
  const { items: audit } = useRecords('TTCAuditLog', '-at');
  const [dialog, setDialog] = useState({ open: false, member: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const openEdit = (member) => {
    setForm(member ? { ...EMPTY, ...member } : { ...EMPTY, permissions: ROLE_DEFAULTS.lead_manager });
    setDialog({ open: true, member });
  };

  const setRole = (role) => setForm((f) => ({ ...f, role, permissions: ROLE_DEFAULTS[role] || [] }));

  const togglePermission = (key) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key],
    }));

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
      if (dialog.member) await ttcDataClient.entities.TTCTeamMember.update(dialog.member.id, payload);
      else await ttcDataClient.entities.TTCTeamMember.create({ ...payload, last_active: new Date().toISOString() });
      setDialog({ open: false, member: null });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member) => {
    await ttcDataClient.entities.TTCTeamMember.update(member.id, { status: member.status === 'active' ? 'disabled' : 'active' });
    reload();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Access control</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Team Management</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Roles and module permissions for everyone operating the desk.</p>
        </div>
        <Button size="sm" disabled title="Team role schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add team member</Button>
      </header>

      <SchemaNotice title="Team management is read-only">
        The current database has an administrator allow-list, not a full team and role-permission model. Existing authorized administrators are displayed, but adding members, changing roles or disabling accounts is not enabled here.
      </SchemaNotice>
      <div className="panel overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Modules</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Last active</th>
                  <th className="px-4 py-2.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {team.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium">{m.name}</p>
                      <p className="text-[10.5px] text-muted-foreground">{m.email || '—'}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge label={TEAM_ROLES.find((r) => r.key === m.role)?.label || m.role} dot={false} /></td>
                    <td className="max-w-[260px] px-3 py-3">
                      <p className="truncate text-[11px] text-muted-foreground">{(m.permissions || []).join(' · ') || '—'}</p>
                    </td>
                    <td className="px-3 py-3"><StatusBadge label={m.status} /></td>
                    <td className="px-3 py-3 font-mono text-[10.5px] text-muted-foreground">{fmtDateTime(m.last_active)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" disabled title="Team permissions are managed in the existing admin allow-list" onClick={() => toggleStatus(m)} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">
                          {m.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" disabled title="Team profile editing is not connected" onClick={() => openEdit(m)} className="grid h-7 w-7 place-items-center rounded-lg border hover:bg-muted">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {team.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-[12px] text-muted-foreground">No team members yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Role permissions" subtitle="Default module access per role" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Modules</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {TEAM_ROLES.map((r) => (
                  <tr key={r.key}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[12px] font-medium">{r.label}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{(ROLE_DEFAULTS[r.key] || []).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 border-t px-4 py-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Financial records can only be edited or deleted by app admins, and payment recording requires a finance or admin role.
          </div>
        </Panel>

        <Panel title="Audit log" subtitle="Every operational change" bodyClassName="p-0">
          <ul className="max-h-[300px] divide-y overflow-y-auto">
            {audit.slice(0, 30).map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-medium">{titleCase(a.action)}</span>
                  <span className="ml-auto font-mono text-[9.5px] text-muted-foreground">{fmtDateTime(a.at)}</span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{a.summary}</p>
              </li>
            ))}
            {audit.length === 0 && <li className="px-4 py-12 text-center text-[12px] text-muted-foreground">No audit entries yet.</li>}
          </ul>
        </Panel>
      </div>

      <Dialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dialog.member ? 'Edit team member' : 'Add team member'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="mb-1 block text-[11px] text-muted-foreground">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Role</Label>
                <select value={form.role} onChange={(e) => setRole(e.target.value)} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  {TEAM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-[11px] text-muted-foreground">Module access</Label>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSION_KEYS.map((key) => {
                  const active = form.permissions.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePermission(key)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-[11px] transition-colors',
                        active ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setDialog({ open: false, member: null })}>Cancel</Button>
              <Button type="submit" disabled>Save member</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}