import { Link } from 'react-router-dom';
import { activeCatalog } from '@/data/catalog';
import { fill, useI18n } from '@/i18n';
import { Container } from '@/components/ui/Container';

export function Footer() {
  const { locale, messages } = useI18n();
  const year = new Date().getFullYear();
  const serviceLinks = [
    { to: '/account', label: messages.nav.account },
    { to: '/favorites', label: messages.nav.favorites },
    { to: '/compare', label: messages.nav.compare },
    { to: '/cart', label: messages.nav.cart },
    { to: '/checkout', label: messages.nav.checkout },
  ];

  return (
    <footer className="mt-12 bg-[#192032] text-white">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <img
            src="/brand/anan-logo.png"
            alt=""
            width={2102}
            height={372}
            className="h-10 w-auto"
          />
          <p className="mt-4 text-sm leading-6 text-white/75">{messages.footer.about}</p>
          <p className="mt-3 text-sm leading-6 text-white/75">{messages.footer.contact}</p>
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{messages.footer.categories}</h2>
          <ul className="mt-3 space-y-2">
            {activeCatalog().categories.map((category) => (
              <li key={category.id}>
                <Link
                  to={`/category/${category.slug}`}
                  className="text-sm text-white/75 hover:text-white"
                >
                  {category.name[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{messages.footer.service}</h2>
          <ul className="mt-3 space-y-2">
            {serviceLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-white/75 hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{messages.footer.info}</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/admin" className="text-sm text-white/75 hover:text-white">
                {messages.nav.admin}
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-white/75">{messages.footer.dev}</p>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-4 text-xs text-white/80 sm:flex-row sm:items-center sm:justify-between">
          <p>{fill(messages.footer.rights, { year })}</p>
          <p>{messages.brand.name}</p>
        </Container>
      </div>
    </footer>
  );
}
