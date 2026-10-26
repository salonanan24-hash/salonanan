import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { activeCatalog, categoryImage, type StoreCategory } from '@/data/catalog';
import { menuSubcategories } from '@/data/listing';
import { useI18n } from '@/i18n';
import { useCompareStore } from '@/stores/compare-store';
import { useFavoritesStore } from '@/stores/favorites-store';

type MenuChild = {
  id: string;
  name: StoreCategory['name'];
  image: string;
  href: string;
};

function menuChildren(category: StoreCategory): MenuChild[] {
  const fallback = category.image || categoryImage(category.slug);
  const pictured = menuSubcategories(category.slug);
  if (category.subcategories?.length) {
    return category.subcategories.map((entry) => ({
      id: entry.id,
      name: entry.name,
      image: entry.image || pictured.find((item) => item.id === entry.id)?.image || fallback,
      href: `/category/${category.slug}?sub=${encodeURIComponent(entry.id)}`,
    }));
  }
  return pictured.map((entry) => ({
    id: entry.id,
    name: entry.name,
    image: entry.image || fallback,
    href: entry.query ? `/category/${entry.categorySlug}?${entry.query}` : `/category/${entry.categorySlug}`,
  }));
}

type MobileNavProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

export function MobileNav({ open, onClose, returnFocusRef }: MobileNavProps) {
  const { locale, messages } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootPageRef = useRef<HTMLDivElement>(null);
  const drillPageRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [panelSlug, setPanelSlug] = useState<string | null>(null);
  const [paneHeight, setPaneHeight] = useState<number | null>(null);
  const categories = activeCatalog().categories;
  const favoriteIds = useFavoritesStore((state) => state.ids);
  const favoritesHydrated = useFavoritesStore((state) => state.hydrated);
  const compareIds = useCompareStore((state) => state.ids);
  const compareHydrated = useCompareStore((state) => state.hydrated);
  const favorites = favoritesHydrated ? favoriteIds.length : 0;
  const compared = compareHydrated ? compareIds.length : 0;

  useEffect(() => {
    if (open) {
      setActiveSlug(null);
      setPanelSlug(null);
      setPresent(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setShown(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setShown(false);
    const timer = window.setTimeout(() => setPresent(false), 700);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!shown) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      onClose();
      returnFocusRef.current?.focus();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [shown, onClose, returnFocusRef]);

  const panel = categories.find((category) => category.slug === panelSlug) ?? null;
  const panelChildren = panel ? menuChildren(panel) : [];

  useLayoutEffect(() => {
    if (!present) return;
    const node = activeSlug ? drillPageRef.current : rootPageRef.current;
    if (!node) return;
    setPaneHeight(node.offsetHeight);
  }, [present, activeSlug, panelSlug, locale, categories.length, panelChildren.length]);

  if (!present) return null;

  function closeAndReturn() {
    onClose();
    returnFocusRef.current?.focus();
  }

  function openCategory(slug: string) {
    setPanelSlug(slug);
    setActiveSlug(slug);
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label={messages.nav.close}
        className={`anan-backdrop absolute inset-0 bg-[#172033] ${shown ? 'is-open' : ''}`}
        onClick={closeAndReturn}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`anan-cat-panel absolute inset-y-0 start-0 flex w-[min(86vw,24rem)] flex-col bg-white shadow-[0_0_40px_rgb(23_32_51/0.2)] ${shown ? 'is-open' : ''}`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {messages.nav.menu}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeAndReturn}
            aria-label={messages.nav.close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label={messages.nav.main} className="flex-1 overflow-y-auto">
          <ul className="sticky top-0 z-10 bg-white">
            <li className="border-b border-line">
              <Link to="/favorites" onClick={closeAndReturn} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-ink">
                <span>{messages.nav.favorites} ({favorites})</span>
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
            <li className="border-b border-line">
              <Link to="/compare" onClick={closeAndReturn} className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-ink">
                <span>{messages.nav.compare} ({compared})</span>
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          </ul>
          <div
            className="anan-menu-viewport"
            style={paneHeight == null ? undefined : { height: paneHeight }}
          >
            <div className={`anan-menu-track ${activeSlug ? 'is-drilled' : ''}`}>
              <div ref={rootPageRef} className="anan-menu-page" aria-hidden={activeSlug != null} inert={activeSlug != null}>
                <h2 className="px-4 pb-2 pt-4 text-lg font-bold text-ink">
                  {messages.nav.allCategories}
                </h2>
                <ul>
                  {categories.map((category) => {
                    const children = menuChildren(category);
                    const nested = children.length > 0;
                    const image = category.image || categoryImage(category.slug);
                    const row = (
                      <>
                        <img src={image} alt="" className="h-12 w-14 shrink-0 object-contain" />
                        <span className="min-w-0 flex-1 text-sm font-bold text-ink">{category.name[locale]}</span>
                        {nested ? <ChevronLeft className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" /> : null}
                      </>
                    );
                    return (
                      <li key={category.id} className="border-t border-line">
                        {nested ? (
                          <button
                            type="button"
                            onClick={() => openCategory(category.slug)}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-start"
                          >
                            {row}
                          </button>
                        ) : (
                          <Link
                            to={`/category/${category.slug}`}
                            onClick={closeAndReturn}
                            className="flex items-center gap-3 px-4 py-3.5"
                          >
                            {row}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div ref={drillPageRef} className="anan-menu-page" aria-hidden={activeSlug == null} inert={activeSlug == null}>
                {panel ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveSlug(null)}
                      aria-label={messages.nav.backToMenu}
                      className="flex w-full items-center justify-center gap-1.5 border-b border-line px-4 py-4 text-base font-bold text-ink"
                    >
                      <span>{panel.name[locale]}</span>
                      <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                    <Link
                      to={`/category/${panel.slug}`}
                      onClick={closeAndReturn}
                      className="block border-b border-line px-4 py-4 text-start text-base font-bold text-ink"
                    >
                      {messages.nav.showAll}
                    </Link>
                    <ul>
                      {panelChildren.map((entry) => (
                        <li key={entry.id} className="border-b border-line">
                          <Link
                            to={entry.href}
                            onClick={closeAndReturn}
                            className="flex items-center gap-3 px-4 py-3.5"
                          >
                            <img src={entry.image} alt="" className="h-12 w-14 shrink-0 object-contain" />
                            <span className="min-w-0 flex-1 text-sm font-bold text-ink">{entry.name[locale]}</span>
                            <ChevronLeft className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
