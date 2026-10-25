import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { activeCatalog, categoryImage } from '@/data/catalog';
import { menuSubcategories } from '@/data/listing';
import { useI18n } from '@/i18n';
import { cn } from '@/components/ui/Container';

type CategoryDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const PANEL_MS = 550;

export function CategoryDrawer({ open, onClose }: CategoryDrawerProps) {
  const { locale, messages } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setActiveId(null);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setShown(false);
    const timer = window.setTimeout(() => {
      setPresent(false);
      setActiveId(null);
    }, PANEL_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    if (!present) return;
    const bar = document.querySelector('[data-store-header]');
    setTop(bar?.getBoundingClientRect().bottom ?? 0);
  }, [present]);

  useEffect(() => {
    if (!shown) return;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [shown, onClose]);

  if (!present) return null;

  const active = activeCatalog().categories.find((category) => category.slug === activeId);
  const entries = active ? menuSubcategories(active.slug) : [];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50" style={{ top }}>
      <button
        type="button"
        aria-label={messages.nav.close}
        className={cn('anan-backdrop absolute inset-0 bg-[#172033]', shown && 'is-open')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        id="all-categories"
        aria-labelledby={titleId}
        className={cn(
          'anan-cat-panel absolute inset-y-0 start-0 flex max-w-full bg-white shadow-[0_0_40px_rgb(23_32_51/0.18)]',
          shown && 'is-open',
        )}
      >
        <div className="flex h-full w-[min(100vw,22rem)] flex-col">
          <div className="flex items-center gap-1 border-b border-line px-2 py-2">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={messages.nav.close}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-[#f4f7fb]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <p id={titleId} className="text-base font-extrabold text-ink">
              {messages.nav.allCategories}
            </p>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {activeCatalog().categories.map((category) => {
              const children = category.subcategories?.length ? category.subcategories : menuSubcategories(category.slug);
              const nested = children.length > 0;
              const selected = activeId === category.slug && nested;
              const image = category.image || categoryImage(category.slug);
              const rowClass = cn(
                'relative flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-start',
                selected ? 'bg-[#f6f8fb]' : 'hover:bg-[#f6f8fb]',
              );
              const thumb = (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center">
                  <img src={image} alt="" className="h-12 w-12 object-contain" />
                </span>
              );

              if (!nested) {
                return (
                  <li key={category.slug}>
                    <Link
                      to={`/category/${category.slug}`}
                      onClick={onClose}
                      onMouseEnter={() => setActiveId(null)}
                      className={rowClass}
                    >
                      {thumb}
                      <span className="min-w-0 flex-1 text-sm font-bold text-ink">{category.name[locale]}</span>
                    </Link>
                  </li>
                );
              }

              return (
                <li key={category.slug}>
                  <button
                    type="button"
                    aria-expanded={selected}
                    onMouseEnter={() => setActiveId(category.slug)}
                    onFocus={() => setActiveId(category.slug)}
                    onClick={() => setActiveId(category.slug)}
                    className={rowClass}
                  >
                    {selected ? (
                      <span className="absolute inset-y-0 start-0 w-1 bg-brand-blue" aria-hidden="true" />
                    ) : null}
                    {thumb}
                    <span className="min-w-0 flex-1 text-sm font-bold text-ink">{category.name[locale]}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {active && (active.subcategories?.length || entries.length > 0) ? (
          <div className="flex h-full w-[min(100vw,22rem)] flex-col border-s border-line">
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-bold text-ink hover:bg-[#f6f8fb]"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              {messages.nav.backToMenu}
            </button>
            <ul className="flex-1 overflow-y-auto">
              {(active.subcategories?.length
                ? active.subcategories.map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                    image: entry.image || categoryImage(active.slug),
                    href: `/category/${active.slug}?sub=${entry.id}`,
                  }))
                : entries.map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                    image: entry.image,
                    href: entry.query
                      ? `/category/${entry.categorySlug}?${entry.query}`
                      : `/category/${entry.categorySlug}`,
                  }))
              ).map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={entry.href}
                    onClick={onClose}
                    className="flex items-center gap-3 border-b border-line px-3 py-2.5 hover:bg-[#f6f8fb]"
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center">
                      <img src={entry.image} alt="" className="h-12 w-12 object-contain" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{entry.name[locale]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
