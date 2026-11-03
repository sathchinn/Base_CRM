import { AlertTriangle } from 'lucide-react';

export default function SchemaNotice({ title = 'Module not connected yet', children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold">{title}</p>
        <div className="mt-1 text-[11.5px] leading-relaxed text-amber-800/90 dark:text-amber-100/80">{children}</div>
      </div>
    </div>
  );
}
