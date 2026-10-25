import { formatMoney, type Money } from '@anan/shared';
import { useI18n } from '@/i18n';

type PriceDisplayProps = {
  price: Money;
  compareAt?: Money | null;
  reserveCompare?: boolean;
  compact?: boolean;
  labelClassName?: string;
};

export function PriceDisplay({
  price,
  compareAt = null,
  reserveCompare = false,
  compact = false,
  labelClassName = '',
}: PriceDisplayProps) {
  const { locale, messages } = useI18n();
  const previous = compareAt ? formatMoney(compareAt, locale) : null;

  const previousLine = previous ? (
    <p
      className={`tabular-nums text-muted line-through ${compact ? 'text-xs leading-4' : 'text-sm'}`}
    >
      {previous}
    </p>
  ) : reserveCompare ? (
    <p className={`invisible ${compact ? 'text-xs leading-4' : 'text-sm'}`} aria-hidden="true">
      —
    </p>
  ) : null;

  return (
    <div>
      <p
        className={`${compact ? 'text-[10px] leading-4 text-muted' : 'text-xs font-medium text-muted'} ${labelClassName}`}
      >
        {messages.product.priceLabel}
      </p>
      {compact ? previousLine : null}
      <p
        className="text-xl font-bold tabular-nums leading-6 text-brand-red"
      >
        {formatMoney(price, locale)}
      </p>
      {compact ? null : previousLine}
    </div>
  );
}
