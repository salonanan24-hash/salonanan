import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { DemoProduct } from '@/data/catalog';
import type { ListingFilter } from '@/data/listing';
import { useI18n } from '@/i18n';
import { FilterFields } from './FilterFields';

type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  filters: readonly ListingFilter[];
  products: readonly DemoProduct[];
  params: URLSearchParams;
  onToggle: (param: string, value: string) => void;
  onPrice: (min: string, max: string) => void;
  onReset: () => void;
};

export function FilterDrawer({ open, onClose, onReset, ...fields }: FilterDrawerProps) {
  const { messages } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label={messages.listing.closeFilters} className="absolute inset-0 bg-[#172033]/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 start-0 flex w-[min(100%,22rem)] flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id={titleId} className="font-bold text-ink">
            {messages.listing.filters}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={messages.listing.closeFilters}
            className="inline-flex h-11 w-11 items-center justify-center"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <FilterFields {...fields} />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
          <button type="button" onClick={onReset} className="h-11 border border-line text-sm font-semibold">
            {messages.listing.reset}
          </button>
          <button type="button" onClick={onClose} className="h-11 bg-brand-blue text-sm font-semibold text-white">
            {messages.listing.showResults}
          </button>
        </div>
      </div>
    </div>
  );
}
