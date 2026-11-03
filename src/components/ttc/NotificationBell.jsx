import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import StatusBadge from '@/components/ttc/StatusBadge';
import { fmtDateTime } from '@/lib/ttc';

export default function NotificationBell() {
  const [items, setItems] = useState([]);

  const load = async () => {
    const page = await ttcDataClient.entities.TTCNotification.list({ sort: '-created_date', limit: 20 });
    setItems(page?.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));

  const markOne = async (item) => {
    if (item.is_read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-xl border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[344px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-[13px] font-semibold">Notification center</p>
          <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Check className="h-3 w-3" /> Mark all read
          </button>
        </div>
        <div className="scroll-thin max-h-[340px] overflow-y-auto">
          {items.length === 0 && <p className="px-4 py-10 text-center text-[12px] text-muted-foreground">No notifications</p>}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markOne(n)}
              className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50"
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-accent'}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-medium">{n.title}</span>
                  {n.type && <StatusBadge label={n.type} className="ml-auto shrink-0" dot={false} />}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{n.body}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">{fmtDateTime(n.created_date)}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}