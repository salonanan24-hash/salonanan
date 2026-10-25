import type { LocalizedText } from '@anan/shared';

/** Category groups for the storefront menu. Ready to map onto a future admin taxonomy. */
export type CatalogMenuGroup = {
  id: string;
  name: LocalizedText;
  slugs: readonly string[];
};

export const catalogMenu: readonly CatalogMenuGroup[] = [
  {
    id: 'cooling',
    name: { he: 'קירור', ar: 'تبريد' },
    slugs: ['refrigerators'],
  },
  {
    id: 'laundry',
    name: { he: 'כביסה', ar: 'غسيل' },
    slugs: ['washing-machines', 'dryers'],
  },
  {
    id: 'kitchen',
    name: { he: 'מטבח', ar: 'مطبخ' },
    slugs: ['ovens', 'cooktops', 'dishwashers', 'small-appliances'],
  },
  {
    id: 'entertainment',
    name: { he: 'בידור', ar: 'ترفيه' },
    slugs: ['televisions'],
  },
  {
    id: 'climate',
    name: { he: 'מיזוג', ar: 'تكييف' },
    slugs: ['air-conditioners'],
  },
  {
    id: 'computing',
    name: { he: 'מחשוב', ar: 'حوسبة' },
    slugs: ['computers', 'smartphones'],
  },
];
