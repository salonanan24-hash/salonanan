import { isAdminEmail } from '@anan/shared';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readResizedImages } from '@/admin/images';
import { adminRequest } from '@/admin/remote';
import { useAuth } from '@/auth/auth-context';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { fill, useI18n } from '@/i18n';
import { apiBase } from '@/lib/api-url';
import { primaryImage, type StoreCatalog } from '@/data/catalog';

const ROTATE_MS = 4000;
const apiUrl = apiBase();

type TargetKind = 'none' | 'category' | 'subcategory' | 'brand' | 'product' | 'package';

type HomeAd = {
  id: string;
  image: string;
  targetKind: TargetKind;
  targetRef: string;
};

type StorePackage = {
  id: string;
  name: { he: string; ar: string };
};

const kinds: TargetKind[] = ['none', 'category', 'subcategory', 'brand', 'product', 'package'];

export function HomeAds() {
  const { messages } = useI18n();
  const copy = messages.home.ads;
  const auth = useAuth();
  const admin = auth.ready && isAdminEmail(auth.user?.email);
  const { data: catalog } = useDevelopmentCatalog();
  const [ads, setAds] = useState<HomeAd[] | null>(null);
  const [packages, setPackages] = useState<StorePackage[]>([]);
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [rtl, setRtl] = useState(() => document.documentElement.dir !== 'ltr');
  const [pos, setPos] = useState(0);
  const [motion, setMotion] = useState(true);
  const posRef = useRef(0);
  const goRef = useRef<(delta: number) => void>(() => {});

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/api/home-ads`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('ads'))))
      .then((body: { ads: HomeAd[] }) => {
        if (active) setAds(Array.isArray(body.ads) ? body.ads : []);
      })
      .catch(() => {
        if (active) setAds([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const count = ads?.length ?? 0;
  const packageAds = ads?.some((ad) => ad.targetKind === 'package') ?? false;

  useEffect(() => {
    if (!packageAds) return;
    let active = true;
    fetch(`${apiUrl}/api/packages`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('packages'))))
      .then((body: { packages: StorePackage[] }) => {
        if (active) setPackages(body.packages ?? []);
      })
      .catch(() => {
        if (active) setPackages([]);
      });
    return () => {
      active = false;
    };
  }, [packageAds]);

  const visible = 1;
  const loop = count > 1;
  const lead = loop ? visible : 0;

  useEffect(() => {
    if (paused || editing || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => goRef.current(-1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, editing, count]);

  useEffect(() => {
    if (!loop || (pos >= lead && pos < lead + count)) return;
    const timer = window.setTimeout(() => {
      const current = posRef.current;
      if (current >= lead && current < lead + count) return;
      const base = current >= lead + count ? current - count : current + count;
      setMotion(false);
      posRef.current = base;
      setPos(base);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMotion(true));
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [pos, lead, count, loop]);

  useLayoutEffect(() => {
    setMotion(false);
    posRef.current = lead;
    setPos(lead);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMotion(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [lead, count]);

  useLayoutEffect(() => {
    const syncDir = () => setRtl(document.documentElement.dir !== 'ltr');
    syncDir();
    const observer = new MutationObserver(syncDir);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const measure = () => setViewportWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [count, editing]);

  if (ads === null) return <div className="min-h-56" aria-hidden="true" />;
  if (ads.length === 0 && !admin) return null;

  const gap = 16;
  const slideWidth = viewportWidth === 0 ? 0 : visible <= 1 ? viewportWidth : (viewportWidth - gap * (visible - 1)) / visible;
  const step = slideWidth + gap;
  const offset = slideWidth === 0 ? 0 : pos * step;
  const extended = loop && ads ? [...ads.slice(-lead), ...ads, ...ads.slice(0, lead)] : ads;

  function place(next: number, animated: boolean) {
    setMotion(animated);
    posRef.current = next;
    setPos(next);
  }

  function go(delta: number) {
    if (!loop) return;
    const current = posRef.current;
    const wrapped = current >= lead + count || current < lead;
    const base = wrapped ? (current >= lead + count ? current - count : current + count) : current;
    if (wrapped) {
      place(base, false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => place(base + delta, true));
      });
      return;
    }
    place(base + delta, true);
  }

  goRef.current = go;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={copy.label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {admin ? (
        <div className="mb-2 flex">
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-blue px-3 text-sm font-bold text-brand-blue"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {editing ? copy.close : copy.edit}
          </button>
        </div>
      ) : null}
      {editing ? (
        <AdEditor
          initial={ads}
          catalog={catalog}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setAds(next);
            setEditing(false);
          }}
        />
      ) : null}
      {count > 0 ? (
        <>
          <div ref={viewportRef} className="relative overflow-hidden">
            {count > 1 ? (
              <>
                <button
                  type="button"
                  aria-label={messages.hero.prev}
                  onClick={() => go(-1)}
                  className="absolute start-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_8px_20px_rgb(23_32_51/0.16)] sm:inline-flex lg:start-3"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={messages.hero.next}
                  onClick={() => go(1)}
                  className="absolute end-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-[0_8px_20px_rgb(23_32_51/0.16)] sm:inline-flex lg:end-3"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null}
            <div
              className="anan-ad-track flex"
              style={{
                gap,
                direction: rtl ? 'rtl' : 'ltr',
                transform: `translate3d(${(rtl ? 1 : -1) * offset}px, 0, 0)`,
                transition: motion ? undefined : 'none',
              }}
            >
              {extended.map((ad, itemIndex) => (
                <div key={`${ad.id}-${itemIndex}`} className="flex shrink-0 justify-center" style={{ width: slideWidth || '100%' }}>
                  <AdSlide ad={ad} catalog={catalog} packages={packages} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : admin ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{copy.empty}</p>
      ) : null}
    </section>
  );
}

function AdSlide({
  ad,
  catalog,
  packages,
}: {
  ad: HomeAd;
  catalog: StoreCatalog;
  packages: StorePackage[];
}) {
  const { locale, messages } = useI18n();
  const href = adHref(ad, catalog, packages);
  const label = adLabel(ad, catalog, packages, locale) || messages.home.ads.slide;
  const className = 'relative block w-full overflow-hidden rounded-2xl bg-[#f6f8fb] xl:h-80';
  const image = (
    <img src={ad.image} alt={label} className="block h-auto w-full xl:absolute xl:inset-0 xl:h-full xl:object-cover" />
  );
  if (!href) return <div className={className}>{image}</div>;
  return (
    <Link to={href} className={className}>
      {image}
    </Link>
  );
}

function AdEditor({
  initial,
  catalog,
  onClose,
  onSaved,
}: {
  initial: HomeAd[];
  catalog: StoreCatalog;
  onClose: () => void;
  onSaved: (ads: HomeAd[]) => void;
}) {
  const { messages } = useI18n();
  const copy = messages.home.ads;
  const [draft, setDraft] = useState(initial);
  const [packages, setPackages] = useState<StorePackage[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle');

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/api/packages`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('packages'))))
      .then((body: { packages: StorePackage[] }) => {
        if (active) setPackages(body.packages ?? []);
      })
      .catch(() => {
        if (active) setPackages([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const ready = draft.every((ad) => ad.image);

  async function save() {
    if (!ready) return;
    setStatus('saving');
    try {
      await adminRequest('/api/admin/home-ads', {
        method: 'PUT',
        body: JSON.stringify({
          ads: draft.map((ad) =>
            ad.targetRef && ad.targetKind !== 'none' ? ad : { ...ad, targetKind: 'none', targetRef: '' },
          ),
        }),
      });
      onSaved(draft);
    } catch {
      setStatus('failed');
    }
  }

  function update(id: string, patch: Partial<HomeAd>) {
    setDraft((current) => current.map((ad) => (ad.id === id ? { ...ad, ...patch } : ad)));
    setStatus('idle');
  }

  return (
    <div className="mb-3 rounded-2xl border border-line bg-white p-4">
      <ul className="space-y-4">
        {draft.map((ad) => (
            <li key={ad.id} className="rounded-xl border border-line p-3">
              {ad.image ? <img src={ad.image} alt="" className="mb-3 h-28 w-full rounded-lg object-cover" /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-dashed border-line px-3 text-xs font-semibold text-muted">
                  {ad.image ? copy.replace : copy.image}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      void readResizedImages([file], 1400).then(([src]) => {
                        if (src) update(ad.id, { image: src });
                      });
                    }}
                  />
                </label>
                <button type="button" className="text-xs font-bold text-brand-red" onClick={() => setDraft((current) => current.filter((item) => item.id !== ad.id))}>
                  {copy.remove}
                </button>
              </div>
              <p className="mt-3 text-xs font-bold text-ink">{copy.target}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={ad.targetKind === kind}
                    onClick={() => update(ad.id, { targetKind: kind, targetRef: '' })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      ad.targetKind === kind ? 'border-brand-blue text-brand-blue' : 'border-line text-ink'
                    }`}
                  >
                    {copy[kind]}
                  </button>
                ))}
              </div>
              {ad.targetKind === 'none' ? null : (
                <TargetPicker
                  kind={ad.targetKind}
                  value={ad.targetRef}
                  catalog={catalog}
                  packages={packages}
                  onChange={(targetRef) => update(ad.id, { targetRef })}
                />
              )}
            </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDraft((current) => [
              ...current,
              { id: `ad-${Math.random().toString(36).slice(2, 10)}`, image: '', targetKind: 'none', targetRef: '' },
            ]);
          }}
          className="inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm font-bold text-ink"
        >
          {copy.add}
        </button>
        <button
          type="button"
          disabled={!ready || status === 'saving'}
          onClick={() => void save()}
          className="inline-flex h-10 items-center rounded-lg bg-brand-blue px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === 'saving' ? copy.saving : copy.save}
        </button>
        <button type="button" onClick={onClose} className="text-sm font-bold text-muted">
          {copy.close}
        </button>
        {status === 'failed' ? <p className="text-sm font-bold text-brand-red">{copy.failed}</p> : null}
      </div>
    </div>
  );
}

const choiceLimit = 40;

function TargetPicker({
  kind,
  value,
  catalog,
  packages,
  onChange,
}: {
  kind: TargetKind;
  value: string;
  catalog: StoreCatalog;
  packages: StorePackage[];
  onChange: (value: string) => void;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.home.ads;
  const selectedProduct = catalog.products.find((product) => product.id === value || product.slug === value);
  const [query, setQuery] = useState('');
  const [categorySlug, setCategorySlug] = useState(kind === 'product' ? (selectedProduct?.categorySlug ?? '') : '');
  const [brandId, setBrandId] = useState(kind === 'product' ? (selectedProduct?.brandId ?? '') : '');

  const needle = query.trim().toLowerCase();
  const productsInCategory = categorySlug
    ? catalog.products.filter((product) => product.categorySlug === categorySlug)
    : catalog.products;
  const brands = catalog.brands.filter((brand) =>
    productsInCategory.some((product) => product.brandId === brand.id || product.brandId === brand.slug),
  );
  const products = productsInCategory.filter((product) => {
    const brand = catalog.brands.find((item) => item.id === product.brandId || item.slug === product.brandId);
    if (brandId && brand?.id !== brandId && brand?.slug !== brandId && product.brandId !== brandId) return false;
    if (!needle) return true;
    const category = catalog.categories.find((item) => item.slug === product.categorySlug);
    const haystack = `${product.name.he} ${product.name.ar} ${brand?.name ?? ''} ${category?.name.he ?? ''} ${category?.name.ar ?? ''}`.toLowerCase();
    return haystack.includes(needle);
  });
  const subs = catalog.categories.flatMap((category) =>
    (category.subcategories ?? []).map((item) => ({
      value: item.id,
      label: `${category.name[locale]} · ${item.name[locale]}`,
      categorySlug: category.slug,
    })),
  );
  const visibleSubs = categorySlug ? subs.filter((item) => item.categorySlug === categorySlug) : subs;
  const plain =
    kind === 'category'
      ? catalog.categories.map((category) => ({ value: category.slug, label: category.name[locale], hint: '', image: '' }))
      : kind === 'brand'
        ? catalog.brands.map((brand) => ({ value: brand.slug, label: brand.name, hint: '', image: '' }))
        : kind === 'package'
          ? packages.map((item) => ({ value: item.id, label: item.name[locale] || item.name.he, hint: '', image: '' }))
          : kind === 'subcategory'
            ? visibleSubs.map((item) => ({ value: item.value, label: item.label, hint: '', image: '' }))
            : products.map((product) => {
                const brand = catalog.brands.find((item) => item.id === product.brandId || item.slug === product.brandId);
                const category = catalog.categories.find((item) => item.slug === product.categorySlug);
                return {
                  value: product.id,
                  label: product.name[locale],
                  hint: [brand?.name, category?.name[locale]].filter(Boolean).join(' · '),
                  image: primaryImage(product).src,
                };
              });
  const filteredPlain = plain.filter((item) => !needle || `${item.label} ${item.hint}`.toLowerCase().includes(needle));
  const choices = kind === 'product' ? plain : filteredPlain;
  const shown = choices.slice(0, choiceLimit);
  const chosen = choices.find((item) => item.value === value) ?? targetOptions(kind, catalog, packages, locale).find((item) => item.value === value);

  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-ink">{copy.choose}</p>
      {chosen ? (
        <p className="mt-1 flex items-center gap-2 text-sm font-bold text-brand-blue">
          {selectedProduct ? (
            <img src={primaryImage(selectedProduct).src} alt="" className="h-9 w-9 rounded-lg bg-[#f6f8fb] object-contain" />
          ) : null}
          <span>
            {copy.chosen}: {chosen.label}
          </span>
        </p>
      ) : null}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={copy.search}
        className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink"
      />
      {kind === 'product' || kind === 'subcategory' ? (
        <FilterChips
          label={copy.category}
          allLabel={copy.allCategories}
          value={categorySlug}
          options={catalog.categories.map((category) => ({ value: category.slug, label: category.name[locale] }))}
          onChange={(next) => {
            setCategorySlug(next);
            setBrandId('');
          }}
        />
      ) : null}
      {kind === 'product' ? (
        <FilterChips
          label={copy.brand}
          allLabel={copy.allBrands}
          value={brandId}
          options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
          onChange={setBrandId}
        />
      ) : null}
      <p className="mt-2 text-[11px] font-bold text-muted">
        {choices.length > shown.length
          ? fill(copy.narrow, { shown: shown.length, count: choices.length })
          : fill(copy.results, { count: choices.length })}
      </p>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{needle || categorySlug || brandId ? copy.noMatches : copy.emptyChoice}</p>
      ) : (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
          {shown.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(option.value)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-start ${selected ? 'bg-[#f3f8fc]' : ''}`}
                >
                  {option.image ? (
                    <img src={option.image} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-[#f6f8fb] object-contain" />
                  ) : null}
                  <span className="min-w-0">
                    <span className={`block text-sm ${selected ? 'font-bold text-brand-blue' : 'text-ink'}`}>{option.label}</span>
                    {option.hint ? <span className="mt-0.5 block text-[11px] text-muted">{option.hint}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChips({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          aria-pressed={value === ''}
          onClick={() => onChange('')}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${value === '' ? 'border-brand-blue text-brand-blue' : 'border-line text-ink'}`}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
              value === option.value ? 'border-brand-blue text-brand-blue' : 'border-line text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function targetOptions(
  kind: TargetKind,
  catalog: StoreCatalog,
  packages: StorePackage[],
  locale: 'he' | 'ar',
): { value: string; label: string }[] {
  if (kind === 'category') {
    return catalog.categories.map((category) => ({ value: category.slug, label: category.name[locale] }));
  }
  if (kind === 'subcategory') {
    return catalog.categories.flatMap((category) =>
      (category.subcategories ?? []).map((item) => ({
        value: item.id,
        label: `${category.name[locale]} · ${item.name[locale]}`,
      })),
    );
  }
  if (kind === 'brand') {
    return catalog.brands.map((brand) => ({ value: brand.slug, label: brand.name }));
  }
  if (kind === 'product') {
    return catalog.products.map((product) => ({ value: product.id, label: product.name[locale] }));
  }
  return packages.map((item) => ({ value: item.id, label: item.name[locale] || item.name.he }));
}

function adHref(ad: HomeAd, catalog: StoreCatalog, packages: StorePackage[]): string | null {
  if (ad.targetKind === 'none' || !ad.targetRef) return null;
  if (ad.targetKind === 'category') {
    const category = catalog.categories.find((item) => item.slug === ad.targetRef || item.id === ad.targetRef);
    return category ? `/category/${category.slug}` : null;
  }
  if (ad.targetKind === 'subcategory') {
    for (const category of catalog.categories) {
      const sub = category.subcategories?.find((item) => item.id === ad.targetRef);
      if (sub) return `/category/${category.slug}?sub=${encodeURIComponent(sub.id)}`;
    }
    return null;
  }
  if (ad.targetKind === 'brand') {
    const brand = catalog.brands.find((item) => item.slug === ad.targetRef || item.id === ad.targetRef);
    return brand ? `/brands/${brand.slug}` : null;
  }
  if (ad.targetKind === 'product') {
    const product = catalog.products.find((item) => item.id === ad.targetRef || item.slug === ad.targetRef);
    return product ? `/product/${product.slug}` : null;
  }
  const item = packages.find((entry) => entry.id === ad.targetRef);
  return item ? `/packages#${item.id}` : null;
}

function adLabel(ad: HomeAd, catalog: StoreCatalog, packages: StorePackage[], locale: 'he' | 'ar'): string {
  if (ad.targetKind === 'none' || !ad.targetRef) return '';
  return targetOptions(ad.targetKind, catalog, packages, locale).find((option) => option.value === ad.targetRef)?.label ?? '';
}
