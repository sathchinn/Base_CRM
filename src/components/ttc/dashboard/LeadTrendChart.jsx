import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Panel from '@/components/ttc/Panel';

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{payload[0]?.value} leads</p>
    </div>
  );
}

export default function LeadTrendChart({ data = [] }) {
  const peak = Math.max(...data.map((d) => d.leads), 1);
  return (
    <Panel title="Lead acquisition" subtitle="Daily inflow by capture date">
      <div className="h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} width={44} />
            <Tooltip content={<Tip />} cursor={{ fill: 'hsl(var(--muted))' }} />
            <Bar dataKey="leads" radius={[5, 5, 0, 0]} animationDuration={800}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.leads === peak ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}