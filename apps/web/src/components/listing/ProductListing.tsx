import { PackageOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DemoProduct } from '@/data/catalog';
import type { ListingFilter } from '@/data/listing';
import { fill, useI18n } from '@/i18n';
import { applyListing, pageSize, parseListingQuery, type SortKey } from '@/lib/product-query';
import { ProductGrid } from '@/components/product/ProductGrid';
import { FilterChips } from './FilterChips';
import { FilterDrawer } from './FilterDrawer';
import { FilterSidebar } from './FilterSidebar';
import { ProductSorting } from './ProductSorting';

type ProductListingProps = {
  products: readonly DemoProduct[];
  filters: readonly ListingFilter[];
};

export function ProductListing({ products, filters }: ProductListingProps) {
  const { locale, messages } = useI18n();
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const query = parseListingQuery(params, filters);
  const filtered = useMemo(
    () => applyListing(products, filters, query, locale),
    [products, filters, query, locale],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(query.page, pages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function update(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next);
  }

  function toggle(param: string, value: string) {
    update((next) => {
      const current = (next.get(param) ?? '').split(',').filter(Boolean);
      const values = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (values.length === 0) next.delete(param);
      else next.set(param, values.join(','));
    });
  }

  function setPrice(min: string, max: string) {
    update((next) => {
      if (min) next.set('min', min);
      else next.delete('min');
      if (max) next.set('max', max);
      else next.delete('max');
    });
  }

  function remove(param: string, value?: string) {
    if (value) toggle(param, value);
    else update((next) => next.delete(param));
  }

  function reset() {
    const next = new URLSearchParams(params);
    for (const filter of filters) {
      if (filter.kind === 'multi') next.delete(filter.param);
    }
    next.delete('min');
    next.delete('max');
    next.delete('sort');
    next.delete('page');
    setParams(next);
    setDrawer(false);
  }

  function setSort(value: SortKey) {
    update((next) => {
      if (value === 'featured') next.delete('sort');
      else next.set('sort', value);
    });
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
  }

  const controls = {
    filters,
    products,
    params,
    onToggle: toggle,
    onPrice: setPrice,
    onReset: reset,
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="hidden lg:block">
        <FilterSidebar {...controls} />
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="h-10 border border-line bg-white px-3 text-sm font-semibold lg:hidden"
            >
              {messages.listing.filters}
            </button>
            <p className="text-sm text-muted">{fill(messages.listing.results, { count: filtered.length })}</p>
          </div>
          <ProductSorting value={query.sort} onChange={setSort} />
        </div>
        <FilterChips filters={filters} params={params} onRemove={remove} />
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-brand-blue" aria-hidden="true" />
            <p className="mt-3 text-lg font-extrabold text-ink">{messages.listing.emptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{messages.listing.emptyBody}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 inline-flex h-10 items-center rounded-md bg-brand-blue px-4 text-sm font-semibold text-white"
            >
              {messages.listing.reset}
            </button>
          </div>
        ) : (
          <ProductGrid products={visible} />
        )}
        {pages > 1 ? (
          <nav aria-label={messages.listing.pagination} className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-10 border border-line bg-white px-3 text-sm font-semibold disabled:opacity-40"
            >
              {messages.listing.prevPage}
            </button>
            <p className="text-sm text-muted">{fill(messages.listing.page, { page, pages })}</p>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="h-10 border border-line bg-white px-3 text-sm font-semibold disabled:opacity-40"
            >
              {messages.listing.nextPage}
            </button>
          </nav>
        ) : null}
      </div>
      <FilterDrawer open={drawer} onClose={() => setDrawer(false)} {...controls} />
    </div>
  );
}
