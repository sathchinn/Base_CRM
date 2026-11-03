import Panel from '@/components/ttc/Panel';

export default function ConversionFunnel({ data = [] }) {
  const top = Math.max(...data.map((d) => d.count), 1);
  return (
    <Panel title="Pipeline funnel" subtitle="Where the book stands right now">
      <ul className="space-y-3">
        {data.map((row, i) => {
          const pct = Math.round((row.count / top) * 100);
          return (
            <li key={row.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] text-muted-foreground">{row.label}</span>
                <span className="font-mono text-[12px] font-medium tnum">{row.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(pct, row.count > 0 ? 6 : 0)}%`,
                    background: `hsl(var(--chart-${(i % 5) + 1}))`,
                    opacity: 0.85,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}