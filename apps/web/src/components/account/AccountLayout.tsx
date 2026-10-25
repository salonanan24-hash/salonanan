import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { useI18n } from '@/i18n';
import { Container } from '@/components/ui/Container';

export function AccountLayout() {
  const { messages } = useI18n();
  const auth = useAuth();
  const copy = messages.account;

  if (!auth.ready) return null;
  if (!auth.user) return <Navigate to="/login" replace />;

  const links = [
    { to: '/account/dashboard', label: copy.dashboard, end: true },
    { to: '/account', label: copy.details, end: true },
    { to: '/account/orders', label: copy.orders, end: false },
    { to: '/account/reviews', label: copy.reviews, end: true },
  ];

  return (
    <Container className="py-8 sm:py-12">
      <div className="grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={copy.menuLabel} className="border-b border-line pb-4 lg:border-b-0 lg:pb-0">
          <ul className="flex gap-4 overflow-x-auto lg:block lg:space-y-1">
            {links.map((link) => (
              <li key={link.to} className="shrink-0">
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
