import { X } from 'lucide-react';
import type { ListingFilter } from '@/data/listing';
import { fill, useI18n } from '@/i18n';

type FilterChipsProps = {
  filters: readonly ListingFilter[];
  params: URLSearchParams;
  onRemove: (param: string, value?: string) => void;
};

export function FilterChips({ filters, params, onRemove }: FilterChipsProps) {
  const { locale, messages } = useI18n();
  const chips: Array<{ key: string; label: string; param: string; value?: string }> = [];

  for (const filter of filters) {
    if (filter.kind !== 'multi') continue;
    for (const value of (params.get(filter.param) ?? '').split(',').filter(Boolean)) {
      const option = filter.options.find((item) => item.value === value);
      chips.push({
        key: `${filter.param}-${value}`,
        label: option?.label[locale] ?? value,
        param: filter.param,
        value,
      });
    }
  }

  const min = params.get('min');
  const max = params.get('max');
  if (min) chips.push({ key: 'min', label: `${messages.listing.priceMin} ${min}`, param: 'min' });
  if (max) chips.push({ key: 'max', label: `${messages.listing.priceMax} ${max}`, param: 'max' });

  if (chips.length === 0) return null;

  return (
    <ul className="mb-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onRemove(chip.param, chip.value)}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink"
          >
            {chip.label}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{fill(messages.listing.removeFilter, { label: chip.label })}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
