import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Panel from '@/components/ttc/Panel';
import { fmtCompact, fmtMoney } from '@/lib/ttc';

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{fmtMoney(payload[0]?.value || 0)}</p>
    </div>
  );
}

export default function RevenueChart({ data = [] }) {
  const total = data.reduce((sum, d) => sum + (d.revenue || 0), 0);
  return (
    <Panel
      title="Revenue trend"
      subtitle="Successful collections across all gateways"
      action={
        <div className="text-right">
          <p className="font-mono text-lg font-medium leading-none tnum">{fmtMoney(total)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">in range</p>
        </div>
      }
    >
      <div className="h-[248px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={fmtCompact} width={54} />
            <Tooltip content={<Tip />} cursor={{ stroke: 'hsl(var(--border))' }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#revFill)"
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}