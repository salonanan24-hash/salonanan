import type { Locale } from './locale.js';

export const ILS = 'ILS' as const;

export type CurrencyCode = typeof ILS;

/** Integer minor units (agorot). Do not use floating-point shekels for money. */
export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

export function ils(amountMinor: number): Money {
  return { amountMinor, currency: ILS };
}

const formatters: Record<Locale, Intl.NumberFormat> = {
  he: new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: ILS,
    maximumFractionDigits: 0,
    numberingSystem: 'latn',
  }),
  ar: new Intl.NumberFormat('ar-IL', {
    style: 'currency',
    currency: ILS,
    maximumFractionDigits: 0,
    numberingSystem: 'latn',
  }),
};

/**
 * Display helper only. Checkout totals, discounts, and delivery fees
 * must be calculated on the server from trusted catalog data.
 */
export function formatMoney(money: Money, locale: Locale): string {
  return formatters[locale].format(money.amountMinor / 100);
}
