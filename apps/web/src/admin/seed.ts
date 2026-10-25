import type { LocalizedText } from '@anan/shared';
import { developmentCatalog, type DemoAttributes, type DemoProduct } from '@/data/catalog';
import { categoryLanding, productSubcategory } from '@/data/listing';
import type { AdminCategory, AdminData, AdminField, AdminProduct, AdminSubcategory, FieldType } from '@/admin/types';

const text = (he: string, ar: string): LocalizedText => ({ he, ar });

function field(slug: string, key: string, he: string, ar: string, type: FieldType): AdminField {
  return { id: `field-${slug}-${key}`, label: text(he, ar), type, section: 'features' };
}

const categoryFields: Record<string, AdminField[]> = {
  refrigerators: [
    field('refrigerators', 'refrigeratorType', 'סוג מקרר', 'نوع الثلاجة', 'text'),
    field('refrigerators', 'freezerPosition', 'מיקום מקפיא', 'موضع الفريزر', 'text'),
    field('refrigerators', 'doors', 'מספר דלתות', 'عدد الأبواب', 'number'),
  ],
  televisions: [
    field('televisions', 'screenInches', 'גודל מסך (אינץ׳)', 'مقاس الشاشة (إنش)', 'number'),
    field('televisions', 'resolution', 'רזולוציה', 'الدقة', 'text'),
    field('televisions', 'smartTv', 'טלוויזיה חכמה', 'تلفزيون ذكي', 'boolean'),
  ],
  'washing-machines': [
    field('washing-machines', 'capacityKg', 'קיבולת (ק״ג)', 'السعة (كغم)', 'number'),
    field('washing-machines', 'loadType', 'סוג פתיחה', 'نوع التعبئة', 'text'),
    field('washing-machines', 'spinRpm', 'סל״ד', 'سرعة العصر', 'number'),
  ],
};

function subsFromProducts(slug: string): AdminSubcategory[] {
  const seen = new Map<string, AdminSubcategory>();
  for (const product of developmentCatalog.products) {
    if (product.categorySlug !== slug) continue;
    const sub = productSubcategory(product);
    if (!sub || sub.id.startsWith('category-') || seen.has(sub.id)) continue;
    seen.set(sub.id, { id: sub.id, name: sub.name, image: '' });
  }
  return [...seen.values()];
}

function subcategoriesFor(slug: string): AdminSubcategory[] {
  if (slug === 'refrigerators') {
    const landing = categoryLanding('refrigerators');
    return (landing?.subcategories ?? [])
      .filter((item) => item.id !== 'all')
      .map((item) => ({ id: `refrigerators-${item.id}`, name: item.name, image: '' }));
  }
  return subsFromProducts(slug);
}

function specValue(value: string | number | boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function specsFor(slug: string, attributes: DemoAttributes): Record<string, string> {
  const pairs: Array<[string, string | number | boolean | undefined]> = [];
  if (slug === 'refrigerators') {
    pairs.push(
      ['refrigeratorType', attributes.refrigeratorType],
      ['freezerPosition', attributes.freezerPosition],
      ['doors', attributes.doors],
    );
  }
  if (slug === 'televisions') {
    pairs.push(
      ['screenInches', attributes.screenInches],
      ['resolution', attributes.resolution],
      ['smartTv', attributes.smartTv],
    );
  }
  if (slug === 'washing-machines') {
    pairs.push(
      ['capacityKg', attributes.capacityKg],
      ['loadType', attributes.loadType],
      ['spinRpm', attributes.spinRpm],
    );
  }
  const specs: Record<string, string> = {};
  for (const [key, value] of pairs) {
    const next = specValue(value);
    if (next !== undefined) specs[`field-${slug}-${key}`] = next;
  }
  return specs;
}

function toProduct(product: DemoProduct): AdminProduct {
  const sub = productSubcategory(product);
  return {
    id: product.id,
    name: product.name,
    priceMinor: product.price.amountMinor,
    brandId: product.brandId,
    categoryId: `cat-${product.categorySlug}`,
    subcategoryId: sub && !sub.id.startsWith('category-') ? sub.id : '',
    specs: specsFor(product.categorySlug, product.attributes),
    variants: [
      {
        id: `${product.id}-variant`,
        color: '',
        colorHex: '#172033',
        stock: 0,
        active: true,
        images: [...product.images]
          .sort((a, b) => a.sort - b.sort)
          .map((image, index) => ({ id: `${product.id}-img-${index}`, src: image.src })),
      },
    ],
  };
}

export function seedAdmin(): AdminData {
  const categories: AdminCategory[] = developmentCatalog.categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    image: '',
    subcategories: subcategoriesFor(category.slug),
    fields: categoryFields[category.slug] ?? [],
  }));

  return {
    categories,
    brands: developmentCatalog.brands.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      image: '',
    })),
    products: developmentCatalog.products.map(toProduct),
    coupons: [],
    settings: { phone: '', zones: [], accent: 'burgundy' },
  };
}
