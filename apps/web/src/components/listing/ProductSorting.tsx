import type { SortKey } from '@/lib/product-query';
import { useI18n } from '@/i18n';

const keys: SortKey[] = ['featured', 'price-asc', 'price-desc', 'name-asc', 'name-desc'];

export function ProductSorting({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
}) {
  const { messages } = useI18n();
  const labels: Record<SortKey, string> = {
    featured: messages.listing.sortFeatured,
    'price-asc': messages.listing.sortPriceAsc,
    'price-desc': messages.listing.sortPriceDesc,
    'name-asc': messages.listing.sortNameAsc,
    'name-desc': messages.listing.sortNameDesc,
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span>{messages.listing.sortLabel}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        className="h-10 border border-line bg-white px-2 text-sm font-semibold text-ink"
      >
        {keys.map((key) => (
          <option key={key} value={key}>
            {labels[key]}
          </option>
        ))}
      </select>
    </label>
  );
}
