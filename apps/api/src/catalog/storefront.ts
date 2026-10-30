import type { CatalogPayload } from '../admin/catalog.js';

const refrigeratorTypes = new Set(['single-door', 'bottom-freezer']);
const freezerPositions = new Set(['bottom']);
const loadTypes = new Set(['front']);

type StoreImage = {
  src: string;
  alt: { he: string; ar: string };
  sort: number;
  kind: 'photo' | 'placeholder';
};

type StoreAttributes = {
  refrigeratorType?: string;
  freezerPosition?: string;
  doors?: number;
  screenInches?: number;
  resolution?: '4k';
  smartTv?: boolean;
  capacityKg?: number;
  loadType?: string;
  spinRpm?: number;
};

function specValue(specs: Record<string, string>, key: string): string | undefined {
  for (const [field, value] of Object.entries(specs)) {
    if (field !== key && !field.endsWith(`-${key}`)) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function numberSpec(specs: Record<string, string>, key: string): number | undefined {
  const raw = specValue(specs, key);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function attributesFrom(specs: Record<string, string>): StoreAttributes {
  const attributes: StoreAttributes = {};
  const refrigeratorType = specValue(specs, 'refrigeratorType');
  if (refrigeratorType && refrigeratorTypes.has(refrigeratorType)) attributes.refrigeratorType = refrigeratorType;
  const freezerPosition = specValue(specs, 'freezerPosition');
  if (freezerPosition && freezerPositions.has(freezerPosition)) attributes.freezerPosition = freezerPosition;
  const doors = numberSpec(specs, 'doors');
  if (doors !== undefined) attributes.doors = doors;
  const screenInches = numberSpec(specs, 'screenInches');
  if (screenInches !== undefined) attributes.screenInches = screenInches;
  const resolution = specValue(specs, 'resolution');
  if (resolution?.toLowerCase() === '4k') attributes.resolution = '4k';
  const smartTv = specValue(specs, 'smartTv');
  if (smartTv === 'yes' || smartTv === 'true') attributes.smartTv = true;
  if (smartTv === 'no' || smartTv === 'false') attributes.smartTv = false;
  const capacityKg = numberSpec(specs, 'capacityKg');
  if (capacityKg !== undefined) attributes.capacityKg = capacityKg;
  const loadType = specValue(specs, 'loadType');
  if (loadType && loadTypes.has(loadType)) attributes.loadType = loadType;
  const spinRpm = numberSpec(specs, 'spinRpm');
  if (spinRpm !== undefined) attributes.spinRpm = spinRpm;
  return attributes;
}

function highlightFrom(
  specs: Record<string, string>,
  subcategory: { he: string; ar: string } | undefined,
): { he: string; ar: string } {
  if (subcategory) return subcategory;
  const line = Object.values(specs)
    .map((value) => value.trim())
    .filter((value) => value && value !== 'yes' && value !== 'no' && value.length <= 80 && /[^\u0000-\u007F]/.test(value))
    .slice(0, 3)
    .join(' · ');
  return { he: line, ar: line };
}

function imagesFrom(product: CatalogPayload['products'][number]): StoreImage[] {
  const active = product.variants.filter((variant) => variant.active);
  const source = active.some((variant) => variant.images.length > 0) ? active : product.variants;
  const images = source.flatMap((variant) => variant.images);
  if (images.length === 0) {
    return [
      {
        src: '/catalog/fallback.webp',
        alt: product.name,
        sort: 0,
        kind: 'placeholder',
      },
    ];
  }
  return images.map((image, index) => ({
    src: image.src,
    alt: product.name,
    sort: index,
    kind: image.src.startsWith('/catalog/vis-') ? 'placeholder' : 'photo',
  }));
}

function detailsFrom(
  specs: Record<string, string>,
  specsAr: Record<string, string>,
  category: CatalogPayload['categories'][number],
) {
  const details = {
    spec: [] as { label: { he: string; ar: string }; value: { he: string; ar: string } }[],
    features: [] as { label: { he: string; ar: string }; value: { he: string; ar: string } }[],
    info: [] as { label: { he: string; ar: string }; value: { he: string; ar: string } }[],
  };
  for (const field of category.fields) {
    const he = specs[field.id]?.trim() ?? '';
    const ar = specsAr[field.id]?.trim() || he;
    if (!he && !ar) continue;
    const section = field.section === 'spec' || field.section === 'info' ? field.section : 'features';
    details[section].push({ label: field.label, value: { he: he || ar, ar } });
  }
  return details;
}

function optionSpecs(variant: CatalogPayload['products'][number]['variants'][number], product: CatalogPayload['products'][number]) {
  return Object.keys(variant.specs).length > 0
    ? { specs: variant.specs, specsAr: variant.specsAr }
    : { specs: product.specs, specsAr: product.specsAr };
}

function screenInches(specs: Record<string, string>, label: string): number | undefined {
  const recorded = numberSpec(specs, 'screenInches');
  if (recorded !== undefined) return recorded;
  const match = label.match(/(\d{2,3})/);
  const value = match ? Number(match[1]) : NaN;
  return value >= 32 && value <= 120 ? value : undefined;
}

function productSlug(id: string): string {
  return id.startsWith('p-') ? id.slice(2) : id.toLowerCase();
}

export function toStorefront(catalog: CatalogPayload) {
  const categories = new Map(catalog.categories.map((category) => [category.id, category]));
  return {
    isDevelopmentFixture: false,
    categories: catalog.categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: { he: '', ar: '' },
      image: category.image,
      subcategories: category.subcategories.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
      })),
    })),
    brands: catalog.brands.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      image: brand.image,
      developmentFixture: false,
    })),
    products: catalog.products.flatMap((product) => {
      const category = categories.get(product.categoryId);
      if (!category) return [];
      const options = product.variants
        .filter((variant) => variant.active)
        .map((variant) => {
          const specs = optionSpecs(variant, product);
          const subcategoryId = variant.subcategoryId || product.subcategoryId;
          return {
            id: variant.id,
            sku: variant.sku,
            label: variant.color,
            subcategoryId,
            price: { amountMinor: variant.priceMinor ?? product.priceMinor, currency: 'ILS' as const },
            onSale: variant.onSale,
            inPackages: variant.inPackages,
            screenInches: screenInches(specs.specs, variant.color),
            details: detailsFrom(specs.specs, specs.specsAr, category),
          };
        });
      const amounts = options.map((option) => option.price.amountMinor);
      const lead = options[0];
      const leadSpecs = lead ? optionSpecs(product.variants.find((variant) => variant.id === lead.id) ?? product.variants[0]!, product) : { specs: product.specs, specsAr: product.specsAr };
      const subcategory = category.subcategories.find((item) => item.id === (lead?.subcategoryId || product.subcategoryId));
      return [
        {
          id: product.id,
          slug: productSlug(product.id),
          categorySlug: category.slug,
          brandId: product.brandId,
          subcategoryId: lead?.subcategoryId || product.subcategoryId,
          name: product.name,
          highlight: highlightFrom(leadSpecs.specs, subcategory?.name),
          price: { amountMinor: amounts.length > 0 ? Math.min(...amounts) : product.priceMinor, currency: 'ILS' as const },
          compareAtPrice: null,
          badges: [],
          developmentFixture: false,
          images: imagesFrom(product),
          attributes: attributesFrom(leadSpecs.specs),
          details: lead?.details ?? detailsFrom(product.specs, product.specsAr, category),
          options,
        },
      ];
    }),
  };
}
