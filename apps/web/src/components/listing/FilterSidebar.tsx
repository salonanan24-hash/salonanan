import type { DemoProduct } from '@/data/catalog';
import type { ListingFilter } from '@/data/listing';
import { useI18n } from '@/i18n';
import { FilterFields } from './FilterFields';

type FilterSidebarProps = {
  filters: readonly ListingFilter[];
  products: readonly DemoProduct[];
  params: URLSearchParams;
  onToggle: (param: string, value: string) => void;
  onPrice: (min: string, max: string) => void;
  onReset: () => void;
};

export function FilterSidebar(props: FilterSidebarProps) {
  const { messages } = useI18n();

  return (
    <aside className="rounded border border-line bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{messages.listing.filters}</h2>
        <button type="button" onClick={props.onReset} className="text-xs font-semibold text-brand-blue">
          {messages.listing.reset}
        </button>
      </div>
      <FilterFields {...props} />
    </aside>
  );
}
