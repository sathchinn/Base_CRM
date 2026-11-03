import { cn } from '@/lib/utils';

export default function Panel({ title, subtitle, action, children, className, bodyClassName }) {
  return (
    <section className={cn('panel flex flex-col overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn('flex-1', bodyClassName || 'p-5')}>{children}</div>
    </section>
  );
}