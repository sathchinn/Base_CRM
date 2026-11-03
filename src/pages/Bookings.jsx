import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth,
  addMonths, subMonths, format,
} from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Clock, Video, Loader2, Users } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import useRecords from '@/hooks/useRecords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/ttc/StatusBadge';
import KpiCard from '@/components/ttc/KpiCard';
import { BOOKING_STATUSES, fmtDateTime, fmtTime, toInputDateTime } from '@/lib/ttc';
import { logAudit } from '@/lib/automations';
import { cn } from '@/lib/utils';
import SchemaNotice from '@/components/ttc/SchemaNotice';

const EMPTY = {
  customer_name: '',
  whatsapp_number: '',
  email: '',
  tradingview_username: '',
  type: 'demo',
  event_name: 'Crude Oil Scalper — Product Demo',
  trainer: '',
  scheduled_at: '',
  duration_minutes: 45,
  capacity: 1,
  meeting_link: '',
  status: 'requested',
  description: '',
  follow_up_notes: '',
};

export default function Bookings() {
  const { items: bookings, loading, reload } = useRecords('TTCBooking', 'scheduled_at');
  const { items: team } = useRecords('TTCTeamMember');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [types, setTypes] = useState('all');
  const [dialog, setDialog] = useState({ open: false, booking: null });
  const [form, setForm] = useState({ ...EMPTY, scheduled_at: toInputDateTime(new Date()) });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const trainers = team.filter((t) => ['trainer', 'admin', 'super_admin'].includes(t.role)).map((t) => t.name).concat(team.map((t) => t.name)).filter(Boolean);
  const trainerOptions = [...new Set(trainers.length ? trainers : ['Aarav Shah', 'Karan Bose', 'Isha Verma'])];

  const visible = bookings.filter((b) => types === 'all' || b.type === types);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const dayItems = visible
    .filter((b) => b.scheduled_at && isSameDay(new Date(b.scheduled_at), selectedDay))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const upcoming = visible
    .filter((b) => b.scheduled_at && new Date(b.scheduled_at) >= new Date() && ['requested', 'confirmed', 'rescheduled'].includes(b.status))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const completedThisMonth = visible.filter(
    (b) => b.status === 'completed' && b.scheduled_at && isSameMonth(new Date(b.scheduled_at), new Date())
  ).length;

  const openDialog = (booking, day) => {
    setError('');
    if (booking) {
      setForm({ ...EMPTY, ...booking, scheduled_at: toInputDateTime(booking.scheduled_at) });
      setDialog({ open: true, booking });
    } else {
      const base = day ? new Date(day) : new Date();
      base.setHours(base.getHours() + 1, 0, 0, 0);
      setForm({ ...EMPTY, scheduled_at: toInputDateTime(base) });
      setDialog({ open: true, booking: null });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.customer_name.trim() || !form.scheduled_at) {
      setError('Customer name and date/time are required.');
      return;
    }
    const start = new Date(form.scheduled_at);
    const end = new Date(start.getTime() + Number(form.duration_minutes || 45) * 60000);

    const clash = visible.find(
      (b) =>
        b.id !== dialog.booking?.id &&
        b.trainer &&
        b.trainer === form.trainer &&
        ['requested', 'confirmed', 'rescheduled'].includes(b.status) &&
        new Date(b.scheduled_at) < end &&
        new Date(new Date(b.scheduled_at).getTime() + Number(b.duration_minutes || 45) * 60000) > start
    );
    if (clash) {
      setError(`${form.trainer} already has "${clash.event_name}" at ${fmtTime(clash.scheduled_at)}. Choose another time or trainer.`);
      return;
    }

    const sameEvent = visible.filter(
      (b) => b.id !== dialog.booking?.id && b.event_name === form.event_name && b.scheduled_at && new Date(b.scheduled_at).getTime() === start.getTime()
    );
    if (sameEvent.length >= Number(form.capacity || 1)) {
      setError(`Capacity reached — "${form.event_name}" at ${fmtTime(start)} already has ${sameEvent.length} attendee(s). Raise capacity or pick another slot.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        duration_minutes: Number(form.duration_minutes || 45),
        capacity: Number(form.capacity || 1),
        scheduled_at: start.toISOString(),
      };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      if (dialog.booking) {
        await ttcDataClient.entities.TTCBooking.update(dialog.booking.id, payload);
        await logAudit('booking_updated', 'TTCBooking', dialog.booking.id, `${payload.customer_name} · ${payload.event_name} updated`);
      } else {
        const created = await ttcDataClient.entities.TTCBooking.create(payload);
        await logAudit('booking_created', 'TTCBooking', created.id, `${payload.customer_name} booked ${payload.event_name}`);
      }
      setDialog({ open: false, booking: null });
      reload();
    } catch (err) {
      setError(err?.message || 'Could not save this booking.');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (booking, status, attendance) => {
    await ttcDataClient.entities.TTCBooking.update(booking.id, { status, attendance: attendance || booking.attendance || '' });
    await logAudit('booking_status', 'TTCBooking', booking.id, `${booking.customer_name}: ${booking.status} → ${status}`);
    reload();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Scheduling</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Demo &amp; Training</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Live product demos and education sessions, with trainer conflict checks.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={types} onChange={(e) => setTypes(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-[12.5px]">
            <option value="all">All sessions</option>
            <option value="demo">Demos</option>
            <option value="training">Training</option>
          </select>
          <Button size="sm" disabled title="Booking schema is not configured yet"><Plus className="mr-1.5 h-3.5 w-3.5" /> New booking</Button>
        </div>
      </header>

      <SchemaNotice title="Booking data is not connected">
        Demo and training bookings do not yet have a table in the current TTC database. This screen is prepared for the workflow, but creating or changing bookings is disabled so no records are stored in a disconnected database.
      </SchemaNotice>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Upcoming sessions" value={upcoming.length} sub="Confirmed and requested" icon={Clock} />
        <KpiCard label="Demos this month" value={visible.filter((b) => b.type === 'demo' && b.scheduled_at && isSameMonth(new Date(b.scheduled_at), new Date())).length} icon={Video} tone="sky" />
        <KpiCard label="Trainings this month" value={visible.filter((b) => b.type === 'training' && b.scheduled_at && isSameMonth(new Date(b.scheduled_at), new Date())).length} icon={Users} tone="amber" />
        <KpiCard label="Completed" value={completedThisMonth} sub="Attendance marked" icon={Clock} tone="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-display text-xl">{format(cursor, 'MMMM yyyy')}</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}>Today</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b text-center text-[10px] uppercase tracking-wider text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {loading ? (
            <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const items = visible.filter((b) => b.scheduled_at && isSameDay(new Date(b.scheduled_at), day));
                const active = isSameDay(day, selectedDay);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      'min-h-[78px] border-b border-r p-1.5 text-left transition-colors last:border-r-0',
                      !isSameMonth(day, cursor) && 'bg-muted/30 text-muted-foreground/50',
                      active && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    <span className={cn('font-mono text-[11px]', isSameDay(day, new Date()) && 'rounded bg-primary px-1 py-0.5 text-primary-foreground')}>
                      {format(day, 'd')}
                    </span>
                    <span className="mt-1 block space-y-0.5">
                      {items.slice(0, 2).map((b) => (
                        <span key={b.id} className="block truncate rounded bg-primary/10 px-1 py-0.5 text-[9.5px] leading-tight text-primary">
                          {fmtTime(b.scheduled_at)} {b.customer_name.split(' ')[0]}
                        </span>
                      ))}
                      {items.length > 2 && <span className="block text-[9px] text-muted-foreground">+{items.length - 2} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel">
            <div className="border-b px-4 py-3">
              <p className="text-[13px] font-semibold">{format(selectedDay, 'EEEE, dd MMM')}</p>
              <p className="text-[11px] text-muted-foreground">{dayItems.length} session(s) scheduled</p>
            </div>
            <div className="divide-y">
              {dayItems.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">Nothing scheduled — pick another day.</p>}
              {dayItems.map((b) => (
                <div key={b.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium">{b.customer_name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{b.event_name}</p>
                    </div>
                    <StatusBadge label={b.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {fmtTime(b.scheduled_at)} · {b.duration_minutes || 45}m · {b.trainer || 'Unassigned'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.status !== 'confirmed' && b.status !== 'completed' && (
                      <button type="button" onClick={() => setStatus(b, 'confirmed')} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">Confirm</button>
                    )}
                    {b.status !== 'completed' && (
                      <button type="button" onClick={() => setStatus(b, 'completed', 'attended')} className="rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">Mark attended</button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button type="button" onClick={() => setStatus(b, 'cancelled')} className="rounded-md border px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10">Cancel</button>
                    )}
                    <button type="button" onClick={() => openDialog(b)} className="ml-auto rounded-md border px-1.5 py-0.5 text-[10px] hover:bg-muted">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="border-b px-4 py-3"><p className="text-[13px] font-semibold">Next up</p></div>
            <ul className="divide-y">
              {upcoming.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">{b.customer_name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">{fmtDateTime(b.scheduled_at)}</span>
                  </span>
                  <StatusBadge label={b.type} dot={false} />
                </li>
              ))}
              {upcoming.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-muted-foreground">No upcoming sessions</li>}
            </ul>
          </div>
        </div>
      </div>

      <Dialog open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog.booking ? 'Edit booking' : 'New demo / training booking'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Customer name *</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">WhatsApp number</Label>
                <Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">TradingView username</Label>
                <Input value={form.tradingview_username} onChange={(e) => setForm({ ...form, tradingview_username: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Booking type</Label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="demo">Product demo</option>
                  <option value="training">Training session</option>
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Event name</Label>
                <Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Trainer / instructor</Label>
                <select value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px]">
                  <option value="">Unassigned</option>
                  {trainerOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Date &amp; time *</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Duration (minutes)</Label>
                <Input type="number" min="15" step="15" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Capacity</Label>
                <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-lg border bg-background px-2 text-[13px] capitalize">
                  {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Meeting link</Label>
                <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://meet.google.com/…" />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Follow-up notes</Label>
                <Input value={form.follow_up_notes} onChange={(e) => setForm({ ...form, follow_up_notes: e.target.value })} />
              </div>
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => setDialog({ open: false, booking: null })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save booking'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}