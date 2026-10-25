import type { Locale } from '@anan/shared';
import type { DemoProduct } from '@/data/catalog';
import type { ListingFilter } from '@/data/listing';

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

export type ListingQuery = {
  selections: Record<string, string[]>;
  min: number | null;
  max: number | null;
  sort: SortKey;
  page: number;
};

const sorts = new Set<SortKey>(['featured', 'price-asc', 'price-desc', 'name-asc', 'name-desc']);

export const pageSize = 12;

export function parseListingQuery(
  params: URLSearchParams,
  filters: readonly ListingFilter[],
): ListingQuery {
  const selections: Record<string, string[]> = {};
  for (const filter of filters) {
    if (filter.kind !== 'multi') continue;
    selections[filter.param] = (params.get(filter.param) ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  const min = numberParam(params.get('min'));
  const max = numberParam(params.get('max'));
  const sortValue = params.get('sort');
  const sort = sortValue && sorts.has(sortValue as SortKey) ? (sortValue as SortKey) : 'featured';
  const pageValue = Number(params.get('page'));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  return { selections, min, max, sort, page };
}

export function applyListing(
  products: readonly DemoProduct[],
  filters: readonly ListingFilter[],
  query: ListingQuery,
  locale: Locale,
): DemoProduct[] {
  const matched = products.filter((product) => {
    const shekels = product.price.amountMinor / 100;
    if (query.min != null && shekels < query.min) return false;
    if (query.max != null && shekels > query.max) return false;
    return filters.every((filter) => {
      if (filter.kind !== 'multi') return true;
      const selected = query.selections[filter.param] ?? [];
      if (selected.length === 0) return true;
      return filter.match(product, selected);
    });
  });

  const sorted = [...matched];
  if (query.sort === 'price-asc') {
    sorted.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
  } else if (query.sort === 'price-desc') {
    sorted.sort((a, b) => b.price.amountMinor - a.price.amountMinor);
  } else if (query.sort === 'name-asc' || query.sort === 'name-desc') {
    sorted.sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale));
    if (query.sort === 'name-desc') sorted.reverse();
  }
  return sorted;
}

function numberParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
