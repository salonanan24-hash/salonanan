import type { Locale } from './locale.js';
import type { Money } from './money.js';

export type ProductBadge = 'offer' | 'bestseller' | 'new';

export type LocalizedText = Record<Locale, string>;

export type CatalogCategory = {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
};

export type CatalogBrand = {
  id: string;
  slug: string;
  name: string;
  image?: string;
  /** Fictional brand used only to build the interface. */
  developmentFixture: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  categorySlug: string;
  brandId: string;
  name: LocalizedText;
  highlight: LocalizedText;
  price: Money;
  compareAtPrice: Money | null;
  badges: ProductBadge[];
  /** When true, prices, stock, and discounts must not be presented as live inventory. */
  developmentFixture: boolean;
};
