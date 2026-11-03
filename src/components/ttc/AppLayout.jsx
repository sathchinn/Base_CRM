import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Moon, Search, Sun, LogOut, X } from 'lucide-react';
import { ttcDataClient } from '@/api/ttcDataClient';
import AppSidebar from '@/components/ttc/AppSidebar';
import NotificationBell from '@/components/ttc/NotificationBell';
import { initials } from '@/lib/ttc';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ttc-nav-collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('ttc-theme') === 'dark');
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('ttc-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    ttcDataClient.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('ttc-nav-collapsed', next ? '1' : '0');
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/leads?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  };

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 ease-out lg:block',
          collapsed ? 'w-[76px]' : 'w-[248px]'
        )}
      >
        <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[264px] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 z-10 grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent"
            >
              <X className="h-4 w-4" />
            </button>
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className={cn('transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 md:px-7">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border bg-card text-muted-foreground lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>

            <form onSubmit={submitSearch} className="relative hidden max-w-sm flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads, numbers, TradingView handles…"
                className="h-9 w-full rounded-xl border bg-card pl-9 pr-3 text-[13px] outline-none transition-all placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/25"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDark(!dark)}
                className="grid h-9 w-9 place-items-center rounded-xl border bg-card text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-[17px] w-[17px]" strokeWidth={1.8} /> : <Moon className="h-[17px] w-[17px]" strokeWidth={1.8} />}
              </button>
              <NotificationBell />
              <div className="ml-1 flex items-center gap-2.5 rounded-xl border bg-card py-1 pl-1 pr-1.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 font-mono text-[11px] font-semibold text-primary">
                  {initials(user?.full_name || user?.email || 'TTC')}
                </span>
                <span className="hidden max-w-[130px] truncate text-[12px] font-medium sm:block">
                  {user?.full_name || user?.email || 'Signed in'}
                </span>
                <button
                  type="button"
                  onClick={() => ttcDataClient.auth.logout()}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-7 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}