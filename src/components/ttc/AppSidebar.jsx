import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Columns3,
  MessageCircle,
  TrendingUp,
  CalendarDays,
  UserRound,
  Repeat,
  CreditCard,
  Package,
  Zap,
  BarChart3,
  ShieldCheck,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GROUPS = [
  {
    label: 'Command',
    items: [{ to: '/', label: 'Overview', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Pipeline',
    items: [
      { to: '/leads', label: 'Leads', icon: Users },
      { to: '/leads-kanban', label: 'Leads Kanban', icon: Columns3 },
      { to: '/whatsapp', label: 'WhatsApp CRM', icon: MessageCircle },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/marketing', label: 'TradingView', icon: TrendingUp },
      { to: '/bookings', label: 'Demo & Training', icon: CalendarDays },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { to: '/customers', label: 'Customers', icon: UserRound },
      { to: '/subscriptions', label: 'Subscriptions', icon: Repeat },
      { to: '/payments', label: 'Payments', icon: CreditCard },
      { to: '/products', label: 'Products & Pricing', icon: Package },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/automation', label: 'Automation', icon: Zap },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/team', label: 'Team', icon: ShieldCheck },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function AppSidebar({ collapsed = false, onToggle, onNavigate, unread = 0 }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex items-center gap-3 px-4 pb-5 pt-6', collapsed && 'justify-center px-2')}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent font-display text-xl text-accent-foreground shadow-inner">
          T
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight">Thanks To Chart</p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/40">
              Crude oil desk
            </p>
          </div>
        )}
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors duration-200',
                        isActive
                          ? 'bg-sidebar-accent font-medium text-sidebar-foreground'
                          : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                        collapsed && 'justify-center px-0'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity',
                            isActive ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && item.to === '/whatsapp' && unread > 0 && (
                          <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-foreground">
                            {unread}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}