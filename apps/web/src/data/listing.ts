import type { LocalizedText } from '@anan/shared';
import {
  activeCatalog,
  brandById,
  categoryImages,
  type DemoProduct,
} from '@/data/catalog';

export type FilterOption = {
  value: string;
  label: LocalizedText;
};

export type MultiFilter = {
  kind: 'multi';
  param: string;
  label: LocalizedText;
  options: readonly FilterOption[];
  match: (product: DemoProduct, selected: readonly string[]) => boolean;
};

export type PriceFilter = {
  kind: 'price';
  param: 'price';
  label: LocalizedText;
};

export type ListingFilter = MultiFilter | PriceFilter;

export type SubcategoryTile = {
  id: string;
  name: LocalizedText;
  image: string;
  imageAlt: LocalizedText;
  /** Empty query clears the subcategory filter. */
  query: string;
};

export type FeatureShortcut = {
  id: string;
  name: LocalizedText;
  query: string;
};

export type BuyingGuide = {
  title: LocalizedText;
  body: LocalizedText;
};

export type CategoryLanding = {
  subcategories: readonly SubcategoryTile[];
  features: readonly FeatureShortcut[];
  guide?: BuyingGuide;
  filters: (products: readonly DemoProduct[]) => ListingFilter[];
};

export type BrandProfile = {
  slug: string;
  name: string;
  kind: 'preview' | 'fixture';
  brandId?: string;
  summary: LocalizedText;
  disclaimer: LocalizedText;
  categorySlugs: readonly string[];
};

const fridgeArt = '/catalog/vis-fridge.webp';

const fridgeAlt: LocalizedText = {
  he: 'איור מקרר על רקע לבן. אינו תצלום של דגם מסוים.',
  ar: 'رسم ثلاجة على خلفية بيضاء. ليس صورة لطراز محدد.',
};

const text = (he: string, ar: string): LocalizedText => ({ he, ar });

const refrigeratorTypes: FilterOption[] = [
  { value: 'single-door', label: text('דלת אחת', 'باب واحد') },
  { value: 'top-freezer', label: text('מקפיא עליון', 'فريزر علوي') },
  { value: 'bottom-freezer', label: text('מקפיא תחתון', 'فريزر سفلي') },
  { value: 'side-by-side', label: text('זה לצד זה', 'جنبًا إلى جنب') },
  { value: 'four-door', label: text('4 דלתות', 'أربعة أبواب') },
  { value: 'built-in', label: text('אינטגרלי', 'مدمجة') },
  { value: 'mini', label: text('מיני', 'صغيرة') },
  { value: 'freezer', label: text('מקפיא', 'فريزر') },
];

function multi(
  param: string,
  label: LocalizedText,
  options: readonly FilterOption[],
  match: MultiFilter['match'],
): MultiFilter {
  return { kind: 'multi', param, label, options, match };
}

function brandFilter(products: readonly DemoProduct[]): MultiFilter {
  const options = [...new Set(products.map((product) => product.brandId))].flatMap((id) => {
    const brand = brandById(id);
    return brand ? [{ value: brand.slug, label: text(brand.name, brand.name) }] : [];
  });
  return multi('brand', text('מותג', 'العلامة'), options, (product, selected) => {
    const brand = brandById(product.brandId);
    return brand ? selected.includes(brand.slug) : false;
  });
}

const priceFilter: PriceFilter = {
  kind: 'price',
  param: 'price',
  label: text('טווח מחיר', 'نطاق السعر'),
};

function attributeEquals(
  read: (product: DemoProduct) => string | undefined,
): MultiFilter['match'] {
  return (product, selected) => {
    const value = read(product);
    return value ? selected.includes(value) : false;
  };
}

const refrigeratorLanding: CategoryLanding = {
  subcategories: [
    { id: 'all', name: text('כל המקררים', 'كل الثلاجات'), image: fridgeArt, imageAlt: fridgeAlt, query: '' },
    {
      id: 'top-freezer',
      name: text('מקפיא עליון', 'فريزر علوي'),
      image: '/catalog/vis-fridge-top.webp',
      imageAlt: fridgeAlt,
      query: 'type=top-freezer',
    },
    {
      id: 'bottom-freezer',
      name: text('מקפיא תחתון', 'فريזר سفلي'),
      image: '/catalog/vis-fridge-bottom.webp',
      imageAlt: fridgeAlt,
      query: 'type=bottom-freezer',
    },
    {
      id: 'side-by-side',
      name: text('זה לצד זה', 'جنبًا إلى جنب'),
      image: '/catalog/vis-fridge-side.webp',
      imageAlt: fridgeAlt,
      query: 'type=side-by-side',
    },
    {
      id: 'four-door',
      name: text('4 דלתות', 'أربعة أبواب'),
      image: '/catalog/vis-fridge-four.webp',
      imageAlt: fridgeAlt,
      query: 'type=four-door',
    },
    {
      id: 'built-in',
      name: text('אינטגרלי', 'مدمجة'),
      image: '/catalog/vis-fridge-built.webp',
      imageAlt: fridgeAlt,
      query: 'type=built-in',
    },
    {
      id: 'mini',
      name: text('מיני', 'صغيرة'),
      image: '/catalog/vis-fridge-mini.webp',
      imageAlt: fridgeAlt,
      query: 'type=mini',
    },
    {
      id: 'freezer',
      name: text('מקפיאים', 'فريزرات'),
      image: '/catalog/vis-freezer.webp',
      imageAlt: fridgeAlt,
      query: 'type=freezer',
    },
    {
      id: 'single-door',
      name: text('דלת אחת', 'باب واحد'),
      image: '/catalog/product-fridge-retro.webp',
      imageAlt: text(
        'תצלום מקרר חד-דלתי ישן על רקע בהיר. אינו דגם מהמלאי.',
        'صورة ثلاجة قديمة بباب واحد على خلفية فاتحة. ليست طرازًا من المخزون.',
      ),
      query: 'type=single-door',
    },
  ],
  features: [
    { id: 'bottom', name: text('מקפיא תחתון', 'فريزر سفلي'), query: 'type=bottom-freezer' },
    { id: 'single', name: text('דלת אחת', 'باب واحد'), query: 'type=single-door' },
  ],
  guide: {
    title: text('לפני הסינון', 'قبل التصفية'),
    body: text(
      'הסינון משתמש רק בערכים שכבר רשומים על מוצר ההדגמה. נפח בליטרים, רוחב וגובה לא מוצגים כי הם לא רשומים. סוג בלי פריט נשאר לבחירה ומראה רשימה ריקה.',
      'التصفية تستخدم فقط القيم المكتوبة أصلًا على منتج العرض. السعة باللتر والعرض والارتفاع غير معروضة لأنها غير مكتوبة. النوع الذي بلا منتج يبقى قابلًا للاختيار ويُظهر قائمة فارغة.',
    ),
  },
  filters: (products) => [
    brandFilter(products),
    multi(
      'type',
      text('סוג מקרר', 'نوع الثلاجة'),
      refrigeratorTypes,
      attributeEquals((product) => product.attributes.refrigeratorType),
    ),
    multi(
      'doors',
      text('מספר דלתות', 'عدد الأبواب'),
      [{ value: '1', label: text('דלת אחת', 'باب واحد') }],
      attributeEquals((product) =>
        product.attributes.doors === undefined ? undefined : String(product.attributes.doors),
      ),
    ),
    multi(
      'freezer',
      text('מיקום מקפיא', 'موضع الفريزر'),
      [{ value: 'bottom', label: text('תחתון', 'سفلي') }],
      attributeEquals((product) => product.attributes.freezerPosition),
    ),
    priceFilter,
  ],
};

const televisionLanding: CategoryLanding = {
  subcategories: [],
  features: [
    { id: '65', name: text('65 אינץ׳', '65 إنش'), query: 'screen=65' },
    { id: '55', name: text('55 אינץ׳', '55 إنش'), query: 'screen=55' },
    { id: '50', name: text('50 אינץ׳', '50 إنش'), query: 'screen=50' },
    { id: '4k', name: text('4K', '4K'), query: 'resolution=4k' },
  ],
  guide: {
    title: text('לפני הסינון', 'قبل التصفية'),
    body: text(
      'גודל המסך ו־4K מופיעים רק איפה שהם רשומים בכרטיס. טכנולוגיית תצוגה לא סוננה כי היא לא רשומה. סימון „חכמה” קיים רק למוצר שהשם שלו מציין זאת.',
      'مقاس الشاشة و4K يظهران فقط حيث هما مكتوبان في البطاقة. لم تُصفَّ تقنية العرض لأنها غير مكتوبة. علامة «ذكي» موجودة فقط للمنتج الذي يذكرها اسمه.',
    ),
  },
  filters: (products) => [
    brandFilter(products),
    multi(
      'screen',
      text('גודל מסך', 'مقاس الشاشة'),
      [
        { value: '65', label: text('65 אינץ׳', '65 إنش') },
        { value: '55', label: text('55 אינץ׳', '55 إنش') },
        { value: '50', label: text('50 אינץ׳', '50 إنش') },
      ],
      attributeEquals((product) =>
        product.attributes.screenInches === undefined
          ? undefined
          : String(product.attributes.screenInches),
      ),
    ),
    multi(
      'resolution',
      text('רזולוציה', 'الدقة'),
      [{ value: '4k', label: text('4K', '4K') }],
      attributeEquals((product) => product.attributes.resolution),
    ),
    multi(
      'smart',
      text('טלוויזיה חכמה', 'تلفزيون ذكي'),
      [{ value: 'yes', label: text('מצוין בשם כמוצר חכם', 'مذكور في الاسم كمنتج ذكي') }],
      (product, selected) => selected.includes('yes') && product.attributes.smartTv === true,
    ),
    priceFilter,
  ],
};

const washerLanding: CategoryLanding = {
  subcategories: [],
  features: [
    { id: '9', name: text('9 ק״ג', '9 كغم'), query: 'capacity=9' },
    { id: 'front', name: text('פתיחה קדמית', 'تعبئة أمامية'), query: 'load=front' },
  ],
  guide: {
    title: text('לפני הסינון', 'قبل التصفية'),
    body: text(
      'קיבולת, פתיחה וסל״ד מופיעים רק כפי שהם רשומים בכרטיס ההדגמה. דירוג אנרגיה לא נוסף כי הוא לא רשום.',
      'السعة ونوع التعبئة وسرعة العصر تظهر فقط كما هي مكتوبة في بطاقة العرض. لم يُضف تصنيف الطاقة لأنه غير مكتوب.',
    ),
  },
  filters: (products) => [
    brandFilter(products),
    multi(
      'capacity',
      text('קיבולת', 'السعة'),
      [{ value: '9', label: text('9 ק״ג', '9 كغم') }],
      attributeEquals((product) =>
        product.attributes.capacityKg === undefined
          ? undefined
          : String(product.attributes.capacityKg),
      ),
    ),
    multi(
      'spin',
      text('סל״ד', 'سرعة العصر'),
      [{ value: '1400', label: text('1,400', '1400') }],
      attributeEquals((product) =>
        product.attributes.spinRpm === undefined ? undefined : String(product.attributes.spinRpm),
      ),
    ),
    multi(
      'load',
      text('סוג פתיחה', 'نوع التعبئة'),
      [{ value: 'front', label: text('קדמית', 'أمامية') }],
      attributeEquals((product) => product.attributes.loadType),
    ),
    priceFilter,
  ],
};

const landings: Record<string, CategoryLanding> = {
  refrigerators: refrigeratorLanding,
  televisions: televisionLanding,
  'washing-machines': washerLanding,
};

export function categoryLanding(slug: string): CategoryLanding | undefined {
  return landings[slug];
}

export type ProductSubcategory = {
  id: string;
  categorySlug: string;
  name: LocalizedText;
  image: string;
  imageAlt: LocalizedText;
  query: string;
};

function fridgeSubcategory(type: string): ProductSubcategory | undefined {
  const tile = refrigeratorLanding.subcategories.find((item) => item.id === type);
  if (!tile) return undefined;
  return {
    id: `refrigerators-${tile.id}`,
    categorySlug: 'refrigerators',
    name: tile.name,
    image: tile.image,
    imageAlt: tile.imageAlt,
    query: tile.query,
  };
}

function sizedSubcategory(
  categorySlug: string,
  id: string,
  name: LocalizedText,
  image: string,
  query: string,
): ProductSubcategory {
  return { id, categorySlug, name, image, imageAlt: name, query };
}

function categorySubcategory(slug: string): ProductSubcategory | undefined {
  const category = activeCatalog().categories.find((item) => item.slug === slug);
  if (!category) return undefined;
  return {
    id: `category-${slug}`,
    categorySlug: slug,
    name: category.name,
    image: categoryImages[slug] ?? '/catalog/fallback.webp',
    imageAlt: category.name,
    query: '',
  };
}

/** Subcategory taken from a spec already written on the product. */
export function productSubcategory(product: DemoProduct): ProductSubcategory | undefined {
  if (product.categorySlug === 'refrigerators' && product.attributes.refrigeratorType) {
    return fridgeSubcategory(product.attributes.refrigeratorType);
  }
  if (product.categorySlug === 'televisions' && product.attributes.screenInches) {
    const inches = product.attributes.screenInches;
    return sizedSubcategory(
      'televisions',
      `tv-${inches}`,
      text(`טלוויזיות ${inches} אינץ׳`, `تلفزيونات ${inches} إنش`),
      categoryImages.televisions ?? '/catalog/vis-tv.webp',
      `screen=${inches}`,
    );
  }
  if (product.categorySlug === 'washing-machines' && product.attributes.capacityKg) {
    const kg = product.attributes.capacityKg;
    return sizedSubcategory(
      'washing-machines',
      `washer-${kg}`,
      text(`מכונות כביסה ${kg} ק״ג`, `غسالات ${kg} كغم`),
      categoryImages['washing-machines'] ?? '/catalog/vis-washer.webp',
      `capacity=${kg}`,
    );
  }
  return categorySubcategory(product.categorySlug);
}

export function menuSubcategories(categorySlug: string): ProductSubcategory[] {
  const products = activeCatalog().products.filter((product) => product.categorySlug === categorySlug);
  return brandSubcategories(products).filter((item) => !item.id.startsWith('category-'));
}

export function brandSubcategories(products: readonly DemoProduct[]): ProductSubcategory[] {
  const seen = new Map<string, ProductSubcategory>();
  for (const product of products) {
    const subcategory = productSubcategory(product);
    if (!subcategory || seen.has(subcategory.id)) continue;
    seen.set(subcategory.id, subcategory);
  }
  return [...seen.values()];
}

export function subcategoryHref(brandSlug: string, subcategory: ProductSubcategory): string {
  const params = new URLSearchParams(subcategory.query);
  params.set('brand', brandSlug);
  return `/category/${subcategory.categorySlug}?${params.toString()}`;
}

export function listingFilters(slug: string, products: readonly DemoProduct[]): ListingFilter[] {
  const filters = landings[slug]?.filters(products) ?? [brandFilter(products), priceFilter];
  return filters.filter((filter) => filter.kind === 'price' || filter.options.length > 0);
}

const samsung: BrandProfile = {
  slug: 'samsung',
  name: 'Samsung',
  kind: 'preview',
  summary: text(
    'עמוד זה מדגים מבנה של חנות מותג בתוך מחסני ענאן.',
    'هذه الصفحة تعرض بنية متجر علامة داخل معرض عنان.',
  ),
  disclaimer: text(
    'אין בקטלוג ההדגמה דגמי Samsung. האתר אינו מציג את מחסני ענאן כמשווק רשמי, ואין כאן מחירים, אחריות או מבצעי יצרן.',
    'لا توجد طرازات Samsung في كتالوج العرض. الموقع لا يقدّم معرض عنان كموزّع رسمي، ولا توجد هنا أسعار أو ضمان أو عروض الشركة المصنّعة.',
  ),
  categorySlugs: ['refrigerators', 'washing-machines', 'televisions', 'dishwashers'],
};

export function brandProfile(slug: string): BrandProfile | undefined {
  const brand = activeCatalog().brands.find((item) => item.slug === slug);
  if (!brand && slug === samsung.slug) return samsung;
  if (!brand) return undefined;
  const categorySlugs = [
    ...new Set(
      activeCatalog().products
        .filter((product) => product.brandId === brand.id)
        .map((product) => product.categorySlug),
    ),
  ];
  return {
    slug: brand.slug,
    name: brand.name,
    kind: 'fixture',
    brandId: brand.id,
    summary: text(
      'המוצרים בעמוד הזה נטענים מהקטלוג שנשמר.',
      'المنتجات في هذه الصفحة تُحمَّل من الكتالوج المحفوظ.',
    ),
    disclaimer: text(
      'המחירים הם אלה שנשמרו בקטלוג. הזמנת ניסיון נשמרת בלי סליקה.',
      'الأسعار هي المحفوظة في الكتالوج. طلب التجربة يُحفظ بدون تحصيل.',
    ),
    categorySlugs,
  };
}

export function brandShowcase(): BrandProfile[] {
  return activeCatalog().brands.flatMap((brand) => {
    const profile = brandProfile(brand.slug);
    return profile ? [profile] : [];
  });
}

export function categoryFilter(slugs: readonly string[]): MultiFilter {
  const options = slugs.flatMap((slug) => {
    const category = activeCatalog().categories.find((item) => item.slug === slug);
    return category ? [{ value: slug, label: category.name }] : [];
  });
  return multi('category', text('קטגוריה', 'الفئة'), options, (product, selected) =>
    selected.includes(product.categorySlug),
  );
}
