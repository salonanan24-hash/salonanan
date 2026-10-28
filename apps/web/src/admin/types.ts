import type { LocalizedText } from '@anan/shared';

export type FieldType = 'text' | 'number' | 'boolean';

export type FieldSection = 'spec' | 'features' | 'info';

export type AdminField = {
  id: string;
  label: LocalizedText;
  type: FieldType;
  section: FieldSection;
};

export type AdminSubcategory = {
  id: string;
  name: LocalizedText;
  image: string;
};

export type AdminCategory = {
  id: string;
  slug: string;
  name: LocalizedText;
  image: string;
  subcategories: AdminSubcategory[];
  fields: AdminField[];
};

export type AdminBrand = {
  id: string;
  slug: string;
  name: string;
  image: string;
};

export type AdminImage = {
  id: string;
  src: string;
};

export type AdminVariant = {
  id: string;
  color: string;
  colorHex: string;
  stock: number;
  active: boolean;
  images: AdminImage[];
};

export type AdminProduct = {
  id: string;
  name: LocalizedText;
  priceMinor: number;
  brandId: string;
  categoryId: string;
  subcategoryId: string;
  specs: Record<string, string>;
  specsAr: Record<string, string>;
  variants: AdminVariant[];
};

export type CouponKind = 'percent' | 'fixed';

export type AdminCoupon = {
  id: string;
  code: string;
  kind: CouponKind;
  value: number;
  endsAt: string;
};

export type ShippingZone = {
  id: string;
  nameHe: string;
  nameAr: string;
  priceMinor: number;
  active: boolean;
  sortOrder: number;
};

export type AdminSettings = {
  phone: string;
  zones: ShippingZone[];
  /** Accent for admin buttons and the active menu item. */
  accent: string;
};

export type AdminData = {
  categories: AdminCategory[];
  brands: AdminBrand[];
  products: AdminProduct[];
  coupons: AdminCoupon[];
  settings: AdminSettings;
};
