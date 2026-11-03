import { ChevronDown } from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { useI18n } from '@/i18n';
import { Container } from '@/components/ui/Container';

export function AccountLayout() {
  const { messages } = useI18n();
  const auth = useAuth();
  const copy = messages.account;
  const location = useLocation();
  const navigate = useNavigate();

  if (!auth.ready) return null;
  if (!auth.user) return <Navigate to="/login" replace />;

  const links = [
    { to: '/account/dashboard', label: copy.dashboard, end: true },
    { to: '/account', label: copy.details, end: true },
    { to: '/account/orders', label: copy.orders, end: false },
    { to: '/account/reviews', label: copy.reviews, end: true },
  ];

  const active =
    links.find((link) =>
      link.end ? location.pathname === link.to : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`),
    ) ?? links[0]!;

  return (
    <Container className="py-6 sm:py-12">
      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={copy.menuLabel} className="lg:pb-0">
          <div className="mb-2 flex items-center justify-between gap-3 lg:hidden">
            <p className="text-base font-extrabold text-ink">{copy.menuAccount}</p>
            <div className="relative min-w-0 flex-1 max-w-48">
              <label className="sr-only" htmlFor="account-section">
                {copy.menuLabel}
              </label>
              <select
                id="account-section"
                value={active.to}
                onChange={(event) => navigate(event.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-line bg-white pe-9 ps-3 text-sm font-semibold text-ink"
              >
                {links.map((link) => (
                  <option key={link.to} value={link.to}>
                    {link.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-ink" aria-hidden="true" />
            </div>
          </div>
          <ul className="hidden gap-4 lg:block lg:space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `block py-2 text-sm ${isActive ? 'font-bold text-ink underline decoration-2 underline-offset-8' : 'text-ink/80 hover:text-ink'}`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </Container>
  );
}
