import { useEffect, useState, type FormEvent } from 'react';
import type { DemoProduct } from '@/data/catalog';
import type { ListingFilter } from '@/data/listing';
import { useI18n } from '@/i18n';

type FilterFieldsProps = {
  filters: readonly ListingFilter[];
  products: readonly DemoProduct[];
  params: URLSearchParams;
  onToggle: (param: string, value: string) => void;
  onPrice: (min: string, max: string) => void;
};

export function FilterFields({ filters, products, params, onToggle, onPrice }: FilterFieldsProps) {
  const { locale, messages } = useI18n();
  const [min, setMin] = useState(params.get('min') ?? '');
  const [max, setMax] = useState(params.get('max') ?? '');

  useEffect(() => {
    setMin(params.get('min') ?? '');
    setMax(params.get('max') ?? '');
  }, [params]);

  function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPrice(min.trim(), max.trim());
  }

  return (
    <div className="space-y-5">
      {filters.map((filter) => {
        if (filter.kind === 'price') {
          return (
            <form key={filter.param} onSubmit={submitPrice}>
              <p className="text-sm font-bold text-ink">{filter.label[locale]}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  inputMode="numeric"
                  value={min}
                  onChange={(event) => setMin(event.target.value)}
                  aria-label={messages.listing.priceMin}
                  placeholder={messages.listing.priceMin}
                  className="h-10 border border-line bg-white px-2 text-sm"
                />
                <input
                  inputMode="numeric"
                  value={max}
                  onChange={(event) => setMax(event.target.value)}
                  aria-label={messages.listing.priceMax}
                  placeholder={messages.listing.priceMax}
                  className="h-10 border border-line bg-white px-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="mt-2 h-9 w-full bg-brand-blue text-xs font-semibold text-white"
              >
                {messages.listing.applyPrice}
              </button>
            </form>
          );
        }

        const selected = new Set(
          (params.get(filter.param) ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        );

        return (
          <fieldset key={filter.param}>
            <legend className="text-sm font-bold text-ink">{filter.label[locale]}</legend>
            <ul className="mt-2 space-y-1">
              {filter.options.map((option) => {
                const count = products.filter((product) => filter.match(product, [option.value])).length;
                const id = `${filter.param}-${option.value}`;
                return (
                  <li key={option.value}>
                    <label htmlFor={id} className="flex items-center gap-2 py-1 text-sm text-ink">
                      <input
                        id={id}
                        type="checkbox"
                        checked={selected.has(option.value)}
                        onChange={() => onToggle(filter.param, option.value)}
                      />
                      <span className="min-w-0 flex-1">{option.label[locale]}</span>
                      <span className="text-xs text-muted">{count}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
