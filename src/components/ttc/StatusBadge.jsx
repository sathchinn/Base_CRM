import { cn } from '@/lib/utils';

const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20',
  brand: 'bg-primary/10 text-primary ring-primary/20',
};

const SUCCESS = ['active', 'successful', 'confirmed', 'converted', 'completed', 'published', 'delivered', 'read', 'attended', 'paid', 'contacted', 'resolved'];
const WARNING = ['pending', 'requested', 'rescheduled', 'trial', 'queued', 'planned', 'payment_pending', 'pending_payment', 'sent', 'boosted', 'invited'];
const DANGER = ['failed', 'cancelled', 'no_show', 'no-show', 'expired', 'not_interested', 'suspended', 'payment_failed', 'overdue', 'unmatched'];
const INFO = ['new', 'interested', 'open', 'demo_scheduled', 'trial_active', 'demo_completed', 'trial_requested', 'created', 'refunded', 'partially_refunded'];

export function toneFor(label) {
  const key = String(label || '').toLowerCase().replace(/\s+/g, '_');
  if (SUCCESS.includes(key)) return 'success';
  if (WARNING.includes(key)) return 'warning';
  if (DANGER.includes(key)) return 'danger';
  if (INFO.includes(key)) return 'info';
  return 'neutral';
}

export default function StatusBadge({ label, tone, className, dot = true }) {
  if (!label) return <span className="text-muted-foreground">—</span>;
  const resolved = TONES[tone] ? tone : toneFor(label);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 ring-inset whitespace-nowrap',
        TONES[resolved],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {String(label).replace(/_/g, ' ')}
    </span>
  );
}