import { useMemo, useState } from 'react';
import { format, subDays, startOfMonth, subMonths } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import useRecords from '@/hooks/useRecords';
import Panel from '@/components/ttc/Panel';
import StatusBadge from '@/components/ttc/StatusBadge';
import { Button } from '@/components/ui/button';
import { SESSIONS, downloadCsv, fmtMoney, fmtCompact, LEAD_SOURCES, LEAD_STAGES } from '@/lib/ttc';
import { cn } from '@/lib/utils';

const RANGES = [
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: '365', label: '12 months' },
];

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Analytics() {
  const { items: leads } = useRecords('TTCLead');
  const { items: transactions } = useRecords('TTCTransaction');
  const { items: subscriptions } = useRecords('TTCSubscription');
  const { items: posts } = useRecords('TTCTradingViewPost');
  const { items: messages } = useRecords('TTCWhatsAppMessage');
  const { items: conversations } = useRecords('TTCConversation');
  const { items: runs } = useRecords('TTCAutomationRun');
  const [range, setRange] = useState('30');

  const from = subDays(new Date(), Number(range) - 1);
  const within = (value) => value && new Date(value) >= from;

  const rangeLeads = leads.filter((l) => within(l.lead_date || l.created_date));
  const rangeTxns = transactions.filter((t) => within(t.paid_at));
  const paid = rangeTxns.filter((t) => t.status === 'successful');
  const revenue = paid.reduce((s, t) => s + Number(t.amount || 0), 0);

  const bySource = useMemo(
    () =>
      LEAD_SOURCES.map((source) => {
        const rows = rangeLeads.filter((l) => (l.lead_source || 'Other') === source);
        const converted = rows.filter((l) => l.status === 'converted').length;
        return { source, leads: rows.length, converted, rate: rows.length ? Math.round((converted / rows.length) * 100) : 0 };
      }).filter((r) => r.leads > 0),
    [rangeLeads]
  );

  const revenueSeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = startOfMonth(subMonths(new Date(), 5 - i));
      return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM'), revenue: 0 };
    });
    const map = new Map(months.map((m) => [m.key, m]));
    transactions
      .filter((t) => t.status === 'successful' && t.paid_at)
      .forEach((t) => {
        const bucket = map.get(format(new Date(t.paid_at), 'yyyy-MM'));
        if (bucket) bucket.revenue += Number(t.amount || 0);
      });
    return months;
  }, [transactions]);

  const bySession = useMemo(
    () =>
      SESSIONS.map((session) => {
        const rows = posts.filter((p) => p.session === session);
        return {
          session,
          posts: rows.length,
          leads: rows.reduce((s, p) => s + Number(p.leads_generated || 0), 0),
          revenue: rows.reduce((s, p) => s + Number(p.revenue || 0), 0),
          conversions: rows.reduce((s, p) => s + Number(p.conversions || 0), 0),
        };
      }),
    [posts]
  );

  const inbound = messages.filter((m) => m.direction === 'inbound').length;
  const outbound = messages.filter((m) => m.direction === 'outbound').length;
  const automated = messages.filter((m) => m.category === 'automated').length;
  const automationSuccess = runs.filter((r) => r.status === 'success').length;
  const automationFailed = runs.filter((r) => r.status === 'failed').length;

  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const trialSubs = subscriptions.filter((s) => s.status === 'trial');
  const churned = subscriptions.filter((s) => ['expired', 'cancelled'].includes(s.status));
  const conversion = leads.length ? Math.round((leads.filter((l) => l.status === 'converted').length / leads.length) * 100) : 0;

  const gatewayRows = Object.entries(
    paid.reduce((acc, t) => {
      const key = t.gateway || 'manual';
      acc[key] = (acc[key] || 0) + Number(t.amount || 0);
      return acc;
    }, {})
  );

  const cards = [
    { label: 'Leads in range', value: rangeLeads.length, sub: `${conversion}% lifetime conversion` },
    { label: 'Revenue in range', value: fmtMoney(revenue), sub: `${paid.length} successful payments` },
    { label: 'Active subscribers', value: activeSubs.length, sub: `${trialSubs.length} on trial` },
    { label: 'Automation reliability', value: `${automationSuccess + automationFailed ? Math.round((automationSuccess / (automationSuccess + automationFailed)) * 100) : 100}%`, sub: `${automationFailed} failed runs` },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">Analytics &amp; Reports</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Every figure below is calculated from live records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn('rounded-xl px-3 py-1.5 text-[12px] transition-colors', range === r.key ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="panel p-4">
            <p className="text-[12px] text-muted-foreground">{c.label}</p>
            <p className="mt-2 font-mono text-[22px] font-medium tnum">{c.value}</p>
            <p className="mt-1 text-[10.5px] text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Revenue by month"
            subtitle="Successful collections, last six months"
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => downloadCsv('ttc-revenue.csv', revenueSeries.map((r) => ({ month: r.label, revenue: r.revenue })))}
              >
                <Download className="mr-1 h-3 w-3" /> CSV
              </Button>
            }
          >
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueSeries} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={fmtCompact} width={56} />
                  <Tooltip
                    formatter={(v) => fmtMoney(v)}
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" radius={[5, 5, 0, 0]} fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="Lead sources" subtitle="Where the book comes from">
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bySource} dataKey="leads" nameKey="source" innerRadius={42} outerRadius={64} paddingAngle={3} strokeWidth={0}>
                  {bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {bySource.map((s, i) => (
              <li key={s.source} className="flex items-center gap-2 text-[11.5px]">
                <span className="h-2 w-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{s.source}</span>
                <span className="ml-auto font-mono tnum">{s.leads}</span>
                <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">{s.rate}%</span>
              </li>
            ))}
            {bySource.length === 0 && <li className="text-[11.5px] text-muted-foreground">No leads in this range</li>}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Marketing by session" subtitle="TradingView performance" bodyClassName="p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Session</th>
                <th className="px-3 py-2 text-right font-medium">Posts</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
                <th className="px-3 py-2 text-right font-medium">Conv.</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bySession.map((s) => (
                <tr key={s.session}>
                  <td className="px-4 py-2.5 text-[12px]">{s.session}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11.5px]">{s.posts}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11.5px]">{s.leads}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11.5px]">{s.conversions}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[11.5px]">{fmtMoney(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="WhatsApp activity" subtitle="Message ledger by category" bodyClassName="p-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Conversations', conversations.length],
              ['Incoming', inbound],
              ['Outgoing', outbound],
              ['Automated', automated],
              ['Unread', conversations.reduce((s, c) => s + Number(c.unread_count || 0), 0)],
              ['Manual takeover', conversations.filter((c) => c.automation_paused).length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="font-mono text-[16px] font-medium tnum">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Pipeline performance" subtitle="Current stage distribution" bodyClassName="p-4">
          <ul className="space-y-2">
            {LEAD_STAGES.map((s, i) => {
              const count = leads.filter((l) => l.status === s.key).length;
              const pct = leads.length ? Math.round((count / leads.length) * 100) : 0;
              return (
                <li key={s.key}>
                  <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-mono tnum">{count} · {pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, count ? 4 : 0)}%`, background: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Financial reconciliation"
          subtitle="Gateway performance in range"
          bodyClassName="p-0"
          action={<StatusBadge label={`${paid.length} settled`} />}
        >
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Gateway</th>
                <th className="px-3 py-2 text-right font-medium">Collected</th>
                <th className="px-4 py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gatewayRows.map(([name, amount]) => (
                <tr key={name}>
                  <td className="px-4 py-2.5 text-[12px] capitalize">{name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11.5px]">{fmtMoney(amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[11.5px]">{revenue ? Math.round((amount / revenue) * 100) : 0}%</td>
                </tr>
              ))}
              {gatewayRows.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-[12px] text-muted-foreground">No payments in this range</td></tr>}
            </tbody>
          </table>
          <div className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
            Churned subscriptions: {churned.length} · Trials running: {trialSubs.length}
          </div>
        </Panel>
      </div>
    </div>
  );
}