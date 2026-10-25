import { Heart, Menu, Scale, ShoppingBag } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { fill, useI18n } from '@/i18n';
import { cartCount, useCartStore } from '@/stores/cart-store';
import { useCompareStore } from '@/stores/compare-store';
import { useFavoritesStore } from '@/stores/favorites-store';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { SearchBar } from '@/components/search/SearchBar';
import { Container } from '@/components/ui/Container';
import { MobileNav } from './MobileNav';

export function Header() {
  const { messages } = useI18n();
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const lines = useCartStore((state) => state.lines);
  const cartHydrated = useCartStore((state) => state.hydrated);
  const favoriteIds = useFavoritesStore((state) => state.ids);
  const favoritesHydrated = useFavoritesStore((state) => state.hydrated);
  const compareIds = useCompareStore((state) => state.ids);
  const compareHydrated = useCompareStore((state) => state.hydrated);
  const count = cartHydrated ? cartCount(lines) : 0;
  const favorites = favoritesHydrated ? favoriteIds.length : 0;
  const compared = compareHydrated ? compareIds.length : 0;

  return (
    <header className="border-b border-line bg-white">
      <Container>
        <div className="flex items-center gap-3 py-3 lg:gap-5 lg:py-3.5">
          <Link to="/" className="shrink-0 rounded-lg transition hover:opacity-90">
            <img
              src="/brand/anan-logo.png"
              alt={messages.brand.logoAlt}
              width={2102}
              height={372}
              className="h-9 w-auto lg:h-12"
            />
          </Link>

          <div className="hidden min-w-0 flex-1 lg:block">
            <SearchBar id="store-search" />
          </div>

          <div className="ms-auto flex items-center gap-1">
            <div className="me-1 hidden lg:block">
              <LanguageSwitcher />
            </div>
            <AccountMenu />
            <HeaderLink
              to="/favorites"
              label={messages.header.favorites}
              ariaLabel={fill(messages.header.favoritesCount, { count: favorites })}
              className="hidden lg:flex"
              badge={favorites}
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
            </HeaderLink>
            <HeaderLink
              to="/compare"
              label={messages.header.compare}
              ariaLabel={fill(messages.header.compareCount, { count: compared })}
              className="hidden lg:flex"
              badge={compared}
            >
              <Scale className="h-5 w-5" aria-hidden="true" />
            </HeaderLink>
            <button
              type="button"
              aria-label={fill(messages.header.cartCount, { count })}
              aria-expanded={cartOpen}
              aria-controls="cart-drawer"
              onClick={() => setCartOpen(true)}
              className="group relative flex h-14 min-w-11 flex-col items-center justify-center rounded-xl px-1.5 text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-[#f4f7fb] hover:text-brand-blue"
            >
              <span className="relative">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {count > 0 ? <CountBadge value={count} /> : null}
              </span>
              <span className="mt-0.5 hidden text-[11px] font-bold leading-4 xl:block">
                {messages.header.cart}
              </span>
            </button>
            <button
              ref={menuRef}
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink transition hover:bg-[#f4f7fb] lg:hidden"
              aria-expanded={open}
              aria-label={open ? messages.nav.close : messages.nav.open}
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="pb-3 lg:hidden">
          <SearchBar id="store-search-mobile" />
        </div>
      </Container>
      <MobileNav
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={menuRef}
        onOpenCart={() => {
          setOpen(false);
          setCartOpen(true);
        }}
      />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}

function HeaderLink({
  to,
  label,
  ariaLabel,
  badge = 0,
  className = '',
  children,
}: {
  to: string;
  label: string;
  ariaLabel?: string;
  badge?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel ?? label}
      className={`group relative h-14 min-w-11 flex-col items-center justify-center rounded-xl px-1.5 text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-[#f4f7fb] hover:text-brand-blue ${className || 'flex'}`}
    >
      <span className="relative">
        {children}
        {badge > 0 ? <CountBadge value={badge} /> : null}
      </span>
      <span className="mt-0.5 hidden text-[11px] font-bold leading-4 xl:block">{label}</span>
    </Link>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -top-2 end-[-10px] flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold leading-none text-white shadow-sm">
      {value > 99 ? '99+' : value}
    </span>
  );
}
