import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import Panel from '@/components/ttc/Panel';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function SubscriptionMix({ data = [] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Panel title="Subscription mix" subtitle="Active plans by cadence">
      <div className="relative h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              strokeWidth={0}
              animationDuration={800}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--popover))',
                fontSize: 12,
              }}
              formatter={(v, n) => [`${v} plans`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-mono text-2xl font-medium leading-none tnum">{total}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">active</p>
          </div>
        </div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="capitalize text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-mono tnum">{d.value}</span>
          </li>
        ))}
        {data.length === 0 && <li className="text-[12px] text-muted-foreground">No active plans yet</li>}
      </ul>
    </Panel>
  );
}