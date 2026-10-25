import { isAdminEmail } from '@anan/shared';
import { ArrowUp, BarChart3, Bell, FolderTree, Gift, LayoutDashboard, Package, Settings, ShoppingCart, Store, Tags, Ticket, Users } from 'lucide-react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState, type CSSProperties } from 'react';
import { resolveAccent } from '@/admin/accent';
import { useAdminStore } from '@/admin/store';
import { startOrderWatch, unlockOrderAlarm } from '@/admin/use-orders';
import { useAuth } from '@/auth/auth-context';
import { StatusPage } from '@/components/ui/StatusPage';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';

const links = [
  { to: '/admin', end: true, key: 'dashboard', icon: LayoutDashboard },
  { to: '/admin/products', end: false, key: 'products', icon: Package },
  { to: '/admin/packages', end: false, key: 'packages', icon: Gift },
  { to: '/admin/categories', end: false, key: 'categories', icon: FolderTree },
  { to: '/admin/brands', end: false, key: 'brands', icon: Tags },
  { to: '/admin/orders', end: false, key: 'orders', icon: ShoppingCart },
  { to: '/admin/customers', end: false, key: 'customers', icon: Users },
  { to: '/admin/coupons', end: false, key: 'coupons', icon: Ticket },
  { to: '/admin/reports', end: false, key: 'reports', icon: BarChart3 },
  { to: '/admin/messages', end: false, key: 'messages', icon: Bell },
  { to: '/admin/settings', end: false, key: 'settings', icon: Settings },
] as const;

export function AdminShell() {
  const { messages } = useI18n();
  const auth = useAuth();
  const accent = resolveAccent(useAdminStore((state) => state.settings.accent));
  const ready = useAdminStore((state) => state.ready);
  const loadError = useAdminStore((state) => state.loadError);
  const saveError = useAdminStore((state) => state.saveError);
  const load = useAdminStore((state) => state.load);
  usePageTitle(messages.admin.title);

  useEffect(() => {
    if (auth.user && isAdminEmail(auth.user.email)) {
      void load().catch(() => undefined);
      startOrderWatch();
    }
  }, [auth.user, load]);

  if (!auth.ready) return null;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (!isAdminEmail(auth.user.email)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <StatusPage title={messages.admin.title} body={messages.admin.body} />
      </div>
    );
  }

  return (
    <div
      className="anan-admin min-h-screen bg-[#eceae6] text-ink"
      style={{ '--admin-accent': accent.hex } as CSSProperties}
      onPointerDown={unlockOrderAlarm}
    >
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-64 flex-col border-e border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-5">
          <NavLink to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand-blue">
            <Store className="size-3.5" aria-hidden="true" />
            {messages.desk.backToStore}
          </NavLink>
          <p className="mt-3 text-lg font-extrabold text-ink">{messages.desk.storeName}</p>
          <p className="text-xs text-muted">{messages.admin.title}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label={messages.admin.title}>
          {links.map((link) => (
            <NavItem key={link.to} link={link} label={messages.desk.nav[link.key]} />
          ))}
        </nav>
      </aside>
      <div className="md:ps-64">
        <nav className="flex gap-2 overflow-x-auto border-b border-line bg-white p-3 md:hidden" aria-label={messages.admin.title}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${isActive ? 'anan-accent-fill' : 'bg-[#f3f5f8] text-ink'}`
              }
            >
              {messages.desk.nav[link.key]}
            </NavLink>
          ))}
        </nav>
        <div className="mx-auto max-w-6xl p-4 md:p-8">
          <div className="rounded-[28px] bg-[#f7f6f3] p-4 sm:p-6 md:p-8">
            {saveError ? <p className="mb-4 text-sm font-semibold anan-accent-text">{messages.desk.saveFailed}</p> : null}
            {!ready ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted">{loadError ? messages.desk.loadFailed : messages.desk.loading}</p>
                {loadError ? (
                  <button type="button" className="anan-accent-fill mt-4 h-10 rounded-xl px-4 text-sm font-bold" onClick={() => void load()}>
                    {messages.desk.retry}
                  </button>
                ) : null}
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
      <BackToTop label={messages.desk.backToTop} />
    </div>
  );
}

function BackToTop({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 280);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="anan-accent-fill fixed bottom-6 end-6 z-30 flex size-12 items-center justify-center rounded-full shadow-[0_8px_24px_rgb(23_32_51/0.18)]"
      aria-label={label}
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }}
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}

function NavItem({
  link,
  label,
}: {
  link: (typeof links)[number];
  label: string;
}) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
          isActive ? 'anan-accent-fill' : 'text-ink hover:bg-[#f3f5f8]'
        }`
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </NavLink>
  );
}
