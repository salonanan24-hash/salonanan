import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activeCatalog, categoryBySlug, searchProducts } from '@/data/catalog';
import { useI18n } from '@/i18n';

type Suggestion =
  | { kind: 'product'; id: string; href: string; label: string; meta: string }
  | { kind: 'category'; id: string; href: string; label: string; meta: string };

type SearchBarProps = {
  id: string;
};

export function SearchBar({ id }: SearchBarProps) {
  const { locale, messages } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [value, setValue] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [armed, setArmed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setValue(query);
  }, [query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const needle = value.trim();
  const suggestions: Suggestion[] =
    needle.length < 2 ? [] : buildSuggestions(needle, locale, messages);
  const visible = open && suggestions.length > 0;

  function goToQuery(next: string) {
    setOpen(false);
    navigate({
      pathname: '/',
      search: next ? `?q=${encodeURIComponent(next)}` : '',
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = visible && armed ? suggestions[active] : undefined;
    if (chosen) {
      setOpen(false);
      navigate(chosen.href);
      return;
    }
    goToQuery(needle);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setArmed(false);
      return;
    }
    if (!visible) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setArmed(true);
      setActive((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setArmed(true);
      setActive((current) => (current - 1 + suggestions.length) % suggestions.length);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <form
        role="search"
        onSubmit={onSubmit}
        className="flex h-12 min-w-0 items-center rounded-full border border-line bg-white pe-1.5 shadow-sm focus-within:border-brand-blue"
      >
        <label htmlFor={id} className="sr-only">
          {messages.search.label}
        </label>
        <input
          id={id}
          name="q"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible && armed ? `${listId}-${active}` : undefined}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setActive(0);
            setArmed(false);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={messages.search.placeholder}
          className="h-full min-w-0 flex-1 rounded-full bg-transparent px-5 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={messages.search.submit}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-white hover:bg-[#c81f22]"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
      {visible ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={messages.search.suggestions}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-2xl border border-line bg-white py-1 shadow-[0_18px_40px_rgb(23_32_51/0.12)]"
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={armed && index === active}
                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm ${
                  armed && index === active ? 'bg-canvas' : 'bg-white'
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  setOpen(false);
                  navigate(item.href);
                }}
              >
                <span className="font-semibold text-ink">{item.label}</span>
                <span className="shrink-0 text-xs text-muted">{item.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function buildSuggestions(
  needle: string,
  locale: 'he' | 'ar',
  messages: { search: { products: string; categories: string } },
): Suggestion[] {
  const folded = needle.toLowerCase();
  const categories = activeCatalog().categories
    .filter((category) => {
      return (
        category.name.he.includes(needle) ||
        category.name.ar.includes(needle) ||
        category.slug.includes(folded)
      );
    })
    .slice(0, 3)
    .map((category) => ({
      kind: 'category' as const,
      id: category.id,
      href: `/category/${category.slug}`,
      label: category.name[locale],
      meta: messages.search.categories,
    }));

  const products = searchProducts(needle)
    .slice(0, 5)
    .map((product) => ({
      kind: 'product' as const,
      id: product.id,
      href: `/product/${product.slug}`,
      label: product.name[locale],
      meta: categoryBySlug(product.categorySlug)?.name[locale] ?? messages.search.products,
    }));

  return [...categories, ...products];
}
