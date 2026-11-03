import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  startOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  format,
} from 'date-fns';
import {
  Users,
  Repeat,
  IndianRupee,
  Clock,
  MessageCircle,
  CalendarDays,
  UserPlus,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import useDashboardData from '@/hooks/useDashboardData';
import KpiCard from '@/components/ttc/KpiCard';
import Panel from '@/components/ttc/Panel';
import StatusBadge from '@/components/ttc/StatusBadge';
import { useNavigate } from 'react-router-dom';
import RevenueChart from '@/components/ttc/dashboard/RevenueChart';
import LeadTrendChart from '@/components/ttc/dashboard/LeadTrendChart';
import SubscriptionMix from '@/components/ttc/dashboard/SubscriptionMix';
import ConversionFunnel from '@/components/ttc/dashboard/ConversionFunnel';
import { fmtMoney, fmtDate, fmtDateTime, LEAD_STAGES, leadStage, daysUntil } from '@/lib/ttc';
import { cn } from '@/lib/utils';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'last', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { leads, subscriptions, transactions, bookings, activity, loading } = useDashboardData();
  const [range, setRange] = useState('30d');
  const now = new Date();
  const [from, setFrom] = useState(format(subDays(now, 14), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(now, 'yyyy-MM-dd'));

  const bounds = useMemo(() => {
    switch (range) {
      case 'today':
        return { from: startOfDay(now), to: now };
      case '7d':
        return { from: startOfDay(subDays(now, 6)), to: now };
      case 'month':
        return { from: startOfMonth(now), to: now };
      case 'last':
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case 'custom':
        return { from: new Date(from), to: new Date(`${to}T23:59:59`) };
      default:
        return { from: startOfDay(subDays(now, 29)), to: now };
    }
  }, [range, from, to]);

  const leadDate = (lead) => lead.lead_date || lead.created_date;

  const inRange = (value) => {
    if (!value) return false;
    const t = new Date(value).getTime();
    return t >= bounds.from.getTime() && t <= bounds.to.getTime();
  };

  const m = useMemo(() => {
    const rangeLeads = leads.filter((l) => inRange(leadDate(l)));
    const newToday = leads.filter((l) => inRange(leadDate(l)) && new Date(leadDate(l)) >= startOfDay(now)).length;
    const activeSubs = subscriptions.filter((s) => s.status === 'active');
    const trials = subscriptions.filter((s) => s.status === 'trial');
    const expiring = trials.filter((s) => {
      const d = daysUntil(s.expiry_date);
      return d !== null && d >= 0 && d <= 2;
    });
    const paid = transactions.filter((t) => t.status === 'successful');
    const rangePaid = paid.filter((t) => inRange(t.paid_at));
    const pending = transactions.filter((t) => ['pending', 'created'].includes(t.status));
    const upcomingDemos = bookings.filter(
      (b) => b.type === 'demo' && new Date(b.scheduled_at) >= now && ['confirmed', 'requested', 'rescheduled'].includes(b.status)
    );
    const renewals = activeSubs.filter((s) => {
      const d = daysUntil(s.renewal_date);
      return d !== null && d >= 0 && d <= 14;
    });
    const converted = leads.filter((l) => l.status === 'converted').length;
    return {
      rangeLeads,
      newToday,
      activeSubs,
      trials,
      expiring,
      totalRevenue: paid.reduce((s, t) => s + Number(t.amount || 0), 0),
      rangeRevenue: rangePaid.reduce((s, t) => s + Number(t.amount || 0), 0),
      pending,
      pendingAmount: pending.reduce((s, t) => s + Number(t.amount || 0), 0),
      upcomingDemos,
      renewals,
      conversion: leads.length ? Math.round((converted / leads.length) * 100) : 0,
      failed: transactions.filter((t) => t.status === 'failed').length,
      successRate: transactions.length
        ? Math.round((paid.length / transactions.filter((t) => t.status !== 'pending' && t.status !== 'created').length || 1) * 100)
        : 0,
    };
  }, [leads, subscriptions, transactions, bookings, range, from, to]);

  const series = useMemo(() => {
    const days = 14;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = subDays(now, days - 1 - i);
      return { day: format(d, 'dd MMM'), key: format(d, 'yyyy-MM-dd'), leads: 0, revenue: 0 };
    });
    const map = new Map(buckets.map((b) => [b.key, b]));
    leads.forEach((l) => {
      const b = map.get(format(new Date(leadDate(l)), 'yyyy-MM-dd'));
      if (b) b.leads += 1;
    });
    transactions
      .filter((t) => t.status === 'successful')
      .forEach((t) => {
        const b = map.get(format(new Date(t.paid_at), 'yyyy-MM-dd'));
        if (b) b.revenue += Number(t.amount || 0);
      });
    return buckets;
  }, [leads, transactions]);

  const mix = useMemo(() => {
    const counts = {};
    m.activeSubs.forEach((s) => {
      const key = s.plan_type || 'other';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [m.activeSubs]);

  const funnel = useMemo(
    () =>
      LEAD_STAGES.map((stage) => ({
        label: stage.label,
        count: leads.filter((l) => l.status === stage.key).length,
      })),
    [leads]
  );

  const followUps = useMemo(
    () =>
      leads
        .filter((l) => l.follow_up_date && !['converted', 'not_interested'].includes(l.status))
        .sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date))
        .slice(0, 5),
    [leads]
  );

  const recentTxns = useMemo(
    () =>
      [...transactions]
        .filter((t) => t.status === 'successful' || t.status === 'pending' || t.status === 'failed')
        .sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0))
        .slice(0, 5),
    [transactions]
  );

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">Business command center</p>
          <h1 className="mt-2 font-display text-4xl leading-[0.95] tracking-tight md:text-[44px]">Overview</h1>
          <p className="mt-2 max-w-md text-[13px] text-muted-foreground">
            Every lead, conversation and rupee from the TradingView desk — connected in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-[12px] transition-colors',
                range === r.key ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-[12px] text-foreground" />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border bg-background px-2 py-1 text-[12px] text-foreground" />
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total leads" value={leads.length} sub={`${m.newToday} captured today`} delta={18} icon={Users} to="/leads" />
        <KpiCard label="Active subscribers" value={m.activeSubs.length} sub={`${m.trials.length} trials running`} delta={12} icon={Repeat} tone="sky" to="/subscriptions" />
        <KpiCard label="Revenue in range" value={fmtMoney(m.rangeRevenue)} sub={`${fmtMoney(m.totalRevenue)} lifetime`} delta={24} icon={IndianRupee} tone="primary" to="/payments" />
        <KpiCard label="Pending payments" value={fmtMoney(m.pendingAmount)} sub={`${m.pending.length} awaiting confirmation`} icon={Clock} tone="amber" to="/payments" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {[
          { label: 'Leads this month', value: leads.filter((l) => leadDate(l) && new Date(leadDate(l)) >= startOfMonth(now)).length, to: '/leads', icon: UserPlus },
          { label: 'WhatsApp unread', value: 4, to: '/whatsapp', icon: MessageCircle },
          { label: 'Active trials', value: m.trials.length, to: '/subscriptions', icon: Zap },
          { label: 'Trials expiring', value: m.expiring.length, to: '/subscriptions', icon: AlertTriangle },
          { label: 'Upcoming demos', value: m.upcomingDemos.length, to: '/bookings', icon: CalendarDays },
          { label: 'Renewals · 14 days', value: m.renewals.length, to: '/subscriptions', icon: Repeat },
          { label: 'Trial → paid', value: `${m.conversion}%`, to: '/analytics', icon: TrendingUp },
          { label: 'Payment success', value: `${m.successRate}%`, to: '/payments', icon: IndianRupee },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:border-primary/30 hover:bg-muted/40"
          >
            <s.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.7} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] text-muted-foreground">{s.label}</span>
              <span className="block font-mono text-[17px] font-medium leading-tight tnum">{s.value}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart data={series} />
        </div>
        <SubscriptionMix data={mix} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LeadTrendChart data={series} />
        </div>
        <ConversionFunnel data={funnel} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Upcoming demos & training"
          subtitle="Confirmed sessions on the calendar"
          className="xl:col-span-1"
          action={
            <Link to="/bookings" className="text-[11px] text-muted-foreground hover:text-foreground">
              View all
            </Link>
          }
          bodyClassName="divide-y p-0"
        >
          {m.upcomingDemos.slice(0, 4).map((b) => (
            <div key={b.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="grid w-11 shrink-0 place-items-center rounded-lg bg-muted py-1.5">
                <span className="font-mono text-[13px] font-semibold leading-none">{format(new Date(b.scheduled_at), 'dd')}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{format(new Date(b.scheduled_at), 'MMM')}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{b.customer_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{b.event_name}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{format(new Date(b.scheduled_at), 'HH:mm')} · {b.trainer}</p>
              </div>
            </div>
          ))}
          {m.upcomingDemos.length === 0 && <p className="px-5 py-8 text-center text-xs text-muted-foreground">No sessions scheduled</p>}
        </Panel>

        <Panel
          title="Pending follow-ups"
          subtitle="Reach out before the day ends"
          action={
            <Link to="/leads" className="text-[11px] text-muted-foreground hover:text-foreground">
              Open leads
            </Link>
          }
          bodyClassName="divide-y p-0"
        >
          {followUps.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => navigate('/leads')}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{l.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{leadStage(l.status).label} · {l.assigned_to || 'Unassigned'}</span>
              </span>
              <span className="shrink-0 text-right">
                <StatusBadge label={l.follow_up_date && new Date(l.follow_up_date) < now ? 'overdue' : 'pending'} />
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{fmtDate(l.follow_up_date)}</span>
              </span>
            </button>
          ))}
          {followUps.length === 0 && <p className="px-5 py-8 text-center text-xs text-muted-foreground">Nothing overdue</p>}
        </Panel>

        <Panel title="Recent activity" subtitle="Live across every module" bodyClassName="p-0">
          <ul className="divide-y">
            {activity.slice(0, 5).map((a) => (
              <li key={a.id} className="flex gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-snug">{a.text}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{fmtDateTime(a.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Recent transactions"
        subtitle="Latest collections and exceptions"
        bodyClassName="p-0"
        action={
          <Link to="/payments" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            Financial ledger <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Reference</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Gateway</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentTxns.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3 font-mono text-[11.5px] text-muted-foreground">{t.transaction_ref}</td>
                  <td className="px-3 py-3 text-[13px]">{t.customer_name}</td>
                  <td className="px-3 py-3 text-[12px] capitalize text-muted-foreground">{t.gateway}</td>
                  <td className="px-3 py-3 font-mono text-[11.5px] text-muted-foreground">{fmtDate(t.paid_at)}</td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] tnum">{fmtMoney(t.amount, t.currency)}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge label={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}