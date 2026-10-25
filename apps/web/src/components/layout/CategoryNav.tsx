import { ChevronDown, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { categoryBySlug } from '@/data/catalog';
import { useI18n } from '@/i18n';
import { CategoryDrawer } from '@/components/layout/CategoryDrawer';
import { cn, Container } from '@/components/ui/Container';

const quickSlugs = [
  'refrigerators',
  'washing-machines',
  'televisions',
  'ovens',
  'dishwashers',
  'air-conditioners',
] as const;

export function CategoryNav() {
  const { locale, messages } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav aria-label={messages.nav.categories} className="relative hidden border-t border-line bg-white lg:block">
      <Container>
        <div className="flex h-12 items-center gap-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="all-categories"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-brand-blue px-3.5 text-sm font-bold text-white shadow-[0_8px_16px_rgb(12_86_149/0.25)] transition hover:bg-brand-blue-dark"
            onClick={() => setOpen((current) => !current)}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            {messages.nav.allCategories}
            <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} aria-hidden="true" />
          </button>
          <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <li className="shrink-0">
              <Link
                to="/packages"
                aria-current={pathname === '/packages' ? 'page' : undefined}
                className={cn(
                  'relative inline-flex h-12 items-center px-3 text-sm font-semibold transition after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-red after:transition',
                  pathname === '/packages'
                    ? 'text-brand-red after:scale-x-100'
                    : 'text-ink after:scale-x-0 hover:text-brand-red hover:after:scale-x-100',
                )}
              >
                {messages.packages.title}
              </Link>
            </li>
            {quickSlugs.map((slug) => {
              const category = categoryBySlug(slug);
              if (!category) return null;
              const active = pathname === `/category/${slug}`;
              return (
                <li key={slug} className="shrink-0">
                  <Link
                    to={`/category/${slug}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex h-12 items-center px-3 text-sm font-semibold transition after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-red after:transition',
                      active
                        ? 'text-brand-red after:scale-x-100'
                        : 'text-ink after:scale-x-0 hover:text-brand-red hover:after:scale-x-100',
                    )}
                  >
                    {category.name[locale]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
      <CategoryDrawer open={open} onClose={() => setOpen(false)} />
    </nav>
  );
}
