import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

export default function KpiCard({ label, value, sub, delta, icon: Icon, tone = 'primary', to }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TONES[tone])}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-[27px] font-medium leading-none tracking-tight tnum">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
              delta >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </>
  );

  const cls =
    'panel block p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(16,24,40,0.08)]';

  if (to) {
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}