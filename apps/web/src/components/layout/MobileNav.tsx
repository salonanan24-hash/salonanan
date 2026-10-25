import { isAdminEmail } from '@anan/shared';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { activeCatalog, categoryBySlug } from '@/data/catalog';
import { catalogMenu } from '@/data/menu';
import { useI18n } from '@/i18n';
import { useAuth } from '@/auth/auth-context';
import { cartCount, useCartStore } from '@/stores/cart-store';
import { useCompareStore } from '@/stores/compare-store';
import { useFavoritesStore } from '@/stores/favorites-store';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onOpenCart: () => void;
};

export function MobileNav({ open, onClose, returnFocusRef, onOpenCart }: MobileNavProps) {
  const { locale, messages } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [groupId, setGroupId] = useState<string | null>(catalogMenu[0]?.id ?? null);
  const auth = useAuth();
  const cartLines = useCartStore((state) => state.lines);
  const favorites = useFavoritesStore((state) => state.ids.length);
  const compared = useCompareStore((state) => state.ids.length);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      onClose();
      returnFocusRef.current?.focus();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  function closeAndReturn() {
    onClose();
    returnFocusRef.current?.focus();
  }

  const links = [
    ...(auth.user
      ? [
          { to: '/account', label: messages.account.menuAccount },
          { to: '/account/orders', label: messages.account.orders },
          ...(isAdminEmail(auth.user.email) ? [{ to: '/admin', label: messages.account.adminLink }] : []),
        ]
      : [{ to: '/login', label: messages.nav.account }]),
    { to: '/favorites', label: `${messages.nav.favorites} (${favorites})` },
    { to: '/compare', label: `${messages.nav.compare} (${compared})` },
    { to: '/cart', label: `${messages.nav.cart} (${cartCount(cartLines)})`, cart: true },
    { to: '/checkout', label: messages.nav.checkout },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label={messages.nav.close}
        className="absolute inset-0 bg-[#172033]/40"
        onClick={closeAndReturn}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 start-0 flex w-[min(100%,22rem)] flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p id={titleId} className="font-bold text-ink">
            {messages.nav.menu}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={closeAndReturn}
            aria-label={messages.nav.close}
            className="inline-flex h-11 w-11 items-center justify-center"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={messages.nav.main} className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs font-semibold text-muted">{messages.nav.categories}</p>
          <ul className="mt-2 border-b border-line pb-4">
            <li className="border-b border-line">
              <Link to="/packages" onClick={closeAndReturn} className="block py-3 text-sm font-bold text-ink">
                {messages.packages.title}
              </Link>
            </li>
            {catalogMenu.map((group) => {
              const slugs = group.slugs.filter((slug) => categoryBySlug(slug));
              if (slugs.length === 0) return null;
              const expanded = groupId === group.id;
              return (
                <li key={group.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setGroupId((current) => (current === group.id ? null : group.id))
                    }
                    className="flex w-full items-center justify-between py-3 text-sm font-bold text-ink"
                  >
                    {group.name[locale]}
                    <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                  </button>
                  {expanded ? (
                    <ul className="pb-3">
                      {slugs.map((slug) => {
                        const category = categoryBySlug(slug);
                        if (!category) return null;
                        return (
                          <li key={slug}>
                            <Link
                              to={`/category/${slug}`}
                              onClick={closeAndReturn}
                              className="block py-2 ps-3 text-sm font-semibold text-ink"
                            >
                              {category.name[locale]}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {activeCatalog()
              .categories.filter((category) => !catalogMenu.some((group) => group.slugs.includes(category.slug)))
              .map((category) => (
                <li key={category.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={`/category/${category.slug}`}
                    onClick={closeAndReturn}
                    className="block py-3 text-sm font-bold text-ink"
                  >
                    {category.name[locale]}
                  </Link>
                </li>
              ))}
          </ul>
          <Link
            to="/brands/samsung"
            onClick={closeAndReturn}
            className="mt-4 block text-sm font-semibold text-ink"
          >
            {messages.brandPage.menuLink}
          </Link>
          <div className="mt-4">
            <LanguageSwitcher />
          </div>
          <ul className="mt-4">
            {links.map((link) => (
              <li key={link.to}>
                {'cart' in link && link.cart ? (
                  <button
                    type="button"
                    onClick={onOpenCart}
                    className="block py-2 text-start text-sm font-semibold text-ink"
                  >
                    {link.label}
                  </button>
                ) : (
                  <Link
                    to={link.to}
                    onClick={closeAndReturn}
                    className="block py-2 text-sm font-semibold text-ink"
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
            {auth.user ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    void auth.signOut();
                    closeAndReturn();
                  }}
                  className="block py-2 text-start text-sm font-semibold text-ink"
                >
                  {messages.account.signOut}
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </div>
  );
}
