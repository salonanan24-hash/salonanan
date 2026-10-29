/**
 * Local development catalog only.
 * Prices, discounts, stock, and brand names here are fixtures.
 * They are not ANAN inventory and must not be treated as a quote.
 */
import {
  ils,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogProduct,
  type LocalizedText,
  type ProductBadge,
} from '@anan/shared';

const categories: CatalogCategory[] = [
  {
    id: 'cat-refrigerators',
    slug: 'refrigerators',
    name: { he: 'מקררים', ar: 'ثلاجات' },
    description: {
      he: 'מקררים גדולים ואינטגרליים מנתוני הפיתוח.',
      ar: 'ثلاجات كبيرة ومدمجة من بيانات التطوير.',
    },
  },
  {
    id: 'cat-washing-machines',
    slug: 'washing-machines',
    name: { he: 'מכונות כביסה', ar: 'غسالات' },
    description: {
      he: 'מכונות כביסה ביתיות מנתוני הפיתוח.',
      ar: 'غسالات منزلية من بيانات التطوير.',
    },
  },
  {
    id: 'cat-dryers',
    slug: 'dryers',
    name: { he: 'מייבשים', ar: 'مجففات' },
    description: {
      he: 'מייבשי כביסה מנתוני הפיתוח.',
      ar: 'مجففات ملابس من بيانات التطوير.',
    },
  },
  {
    id: 'cat-televisions',
    slug: 'televisions',
    name: { he: 'טלוויזיות', ar: 'تلفزيونات' },
    description: {
      he: 'טלוויזיות חכמות מנתוני הפיתוח.',
      ar: 'تلفزيونات ذكية من بيانات التطوير.',
    },
  },
  {
    id: 'cat-ovens',
    slug: 'ovens',
    name: { he: 'תנורים', ar: 'أفران' },
    description: {
      he: 'תנורי בישול ואפייה מנתוני הפיתוח.',
      ar: 'أفران طهي من بيانات التطوير.',
    },
  },
  {
    id: 'cat-cooktops',
    slug: 'cooktops',
    name: { he: 'כיריים', ar: 'مواقد' },
    description: {
      he: 'כיריים מנתוני הפיתוח.',
      ar: 'أفران مسطحة من بيانات التطوير.',
    },
  },
  {
    id: 'cat-dishwashers',
    slug: 'dishwashers',
    name: { he: 'מדיחי כלים', ar: 'جلايات صحون' },
    description: {
      he: 'מדיחי כלים ביתיים מנתוני הפיתוח.',
      ar: 'جلايات صحون منزلية من بيانات التطوير.',
    },
  },
  {
    id: 'cat-air-conditioners',
    slug: 'air-conditioners',
    name: { he: 'מזגנים', ar: 'مكيفات' },
    description: {
      he: 'מזגנים מנתוני הפיתוח.',
      ar: 'مكيفات من بيانات التطوير.',
    },
  },
  {
    id: 'cat-small-appliances',
    slug: 'small-appliances',
    name: { he: 'מוצרי מטבח', ar: 'أجهزة المطبخ' },
    description: {
      he: 'מכשירי חשמל קטנים למטבח מנתוני הפיתוח.',
      ar: 'أجهزة مطبخ صغيرة من بيانات التطوير.',
    },
  },
  {
    id: 'cat-computers',
    slug: 'computers',
    name: { he: 'מחשבים', ar: 'حواسيب' },
    description: {
      he: 'מחשבים ניידים מנתוני הפיתוח.',
      ar: 'حواسيب محمولة من بيانات التطوير.',
    },
  },
  {
    id: 'cat-smartphones',
    slug: 'smartphones',
    name: { he: 'סמארטפונים', ar: 'هواتف ذكية' },
    description: {
      he: 'טלפונים חכמים מנתוני הפיתוח.',
      ar: 'هواتف ذكية من بيانات التطوير.',
    },
  },
];

const brands: CatalogBrand[] = [
  { id: 'solara', slug: 'solara', name: 'Solara', developmentFixture: true },
  { id: 'tekora', slug: 'tekora', name: 'Tekora', developmentFixture: true },
  { id: 'briza', slug: 'briza', name: 'Briza', developmentFixture: true },
  { id: 'novent', slug: 'novent', name: 'Novent', developmentFixture: true },
  { id: 'lumio', slug: 'lumio', name: 'Lumio', developmentFixture: true },
  { id: 'ardent', slug: 'ardent', name: 'Ardent', developmentFixture: true },
];

const products: CatalogProduct[] = [
  {
    id: 'p-solara-fridge-580',
    slug: 'solara-fridge-580',
    categorySlug: 'refrigerators',
    brandId: 'solara',
    name: { he: 'מקרר עם מקפיא תחתון', ar: 'ثلاجة بفريزر سفلي' },
    highlight: {
      he: 'מקפיא תחתון · תמונת המחשה · נתון פיתוח',
      ar: 'فريزر سفلي · صورة توضيحية · بيان تطوير',
    },
    price: ils(499000),
    compareAtPrice: ils(569000),
    badges: ['offer', 'bestseller'],
    developmentFixture: true,
  },
  {
    id: 'p-tekora-washer-9',
    slug: 'tekora-washer-9',
    categorySlug: 'washing-machines',
    brandId: 'tekora',
    name: { he: 'מכונת כביסה 9 ק״ג', ar: 'غسالة تعبئة أمامية 9 كغم' },
    highlight: {
      he: 'פתיחה קדמית · 1,400 סל״ד לדוגמה · נתון פיתוח',
      ar: 'تعبئة أمامية · 1400 دورة تجريبية · بيان تطوير',
    },
    price: ils(219000),
    compareAtPrice: null,
    badges: ['bestseller'],
    developmentFixture: true,
  },
  {
    id: 'p-briza-dryer-8',
    slug: 'briza-dryer-8',
    categorySlug: 'dryers',
    brandId: 'briza',
    name: { he: 'מייבש כביסה 8 ק״ג', ar: 'مجفف ملابس 8 كغم' },
    highlight: {
      he: 'ייבוש בעיבוי · חיישן לחות לדוגמה · נתון פיתוח',
      ar: 'تجفيف بالتكثيف · حساس رطوبة تجريبي · بيان تطوير',
    },
    price: ils(189000),
    compareAtPrice: null,
    badges: ['new'],
    developmentFixture: true,
  },
  {
    id: 'p-novent-tv-65',
    slug: 'novent-tv-65',
    categorySlug: 'televisions',
    brandId: 'novent',
    name: { he: 'טלוויזיה חכמה 65 אינץ׳', ar: 'تلفزيون ذكي 65 إنش' },
    highlight: {
      he: 'מסך 4K לדוגמה · מערכת חכמה · נתון פיתוח',
      ar: 'شاشة 4K تجريبية · نظام ذكي · بيان تطوير',
    },
    price: ils(279000),
    compareAtPrice: ils(339000),
    badges: ['offer', 'bestseller'],
    developmentFixture: true,
  },
  {
    id: 'p-lumio-oven-60',
    slug: 'lumio-oven-60',
    categorySlug: 'ovens',
    brandId: 'lumio',
    name: { he: 'תנור בנוי 60 ס״מ', ar: 'فرن مدمج 60 سم' },
    highlight: {
      he: 'תשע תוכניות לדוגמה · טורבו · נתון פיתוח',
      ar: 'تسع برامج تجريبية · تربو · بيان تطوير',
    },
    price: ils(159000),
    compareAtPrice: null,
    badges: [],
    developmentFixture: true,
  },
  {
    id: 'p-ardent-dishwasher-14',
    slug: 'ardent-dishwasher-14',
    categorySlug: 'dishwashers',
    brandId: 'ardent',
    name: { he: 'מדיח כלים 14 מערכות', ar: 'جلاية صحون سعة 14 طقم' },
    highlight: {
      he: 'חצי טעינה לדוגמה · סל עליון · נתון פיתוח',
      ar: 'نصف حمولة تجريبية · سلة علوية · بيان تطوير',
    },
    price: ils(199000),
    compareAtPrice: ils(249000),
    badges: ['offer'],
    developmentFixture: true,
  },
  {
    id: 'p-briza-ac-15',
    slug: 'briza-ac-15',
    categorySlug: 'air-conditioners',
    brandId: 'briza',
    name: { he: 'מזגן — יחידה חיצונית', ar: 'مكيف — وحدة خارجية' },
    highlight: {
      he: 'תמונת יחידת חוץ להמחשה · נתון פיתוח',
      ar: 'صورة وحدة خارجية للتوضيح · بيان تطوير',
    },
    price: ils(249000),
    compareAtPrice: null,
    badges: ['bestseller'],
    developmentFixture: true,
  },
  {
    id: 'p-solara-mixer-1200',
    slug: 'solara-mixer-1200',
    categorySlug: 'small-appliances',
    brandId: 'solara',
    name: { he: 'מיקסר שף 1,200 ואט', ar: 'عجانة 1200 واط' },
    highlight: {
      he: 'קערה 5 ליטר לדוגמה · נתון פיתוח',
      ar: 'وعاء 5 لتر تجريبي · بيان تطوير',
    },
    price: ils(49000),
    compareAtPrice: ils(69000),
    badges: ['offer', 'new'],
    developmentFixture: true,
  },
  {
    id: 'p-tekora-laptop-16',
    slug: 'tekora-laptop-16',
    categorySlug: 'computers',
    brandId: 'tekora',
    name: { he: 'מחשב נייד 16 אינץ׳', ar: 'حاسوب محمول 16 إنش' },
    highlight: {
      he: 'זיכרון 16GB לדוגמה · נתון פיתוח',
      ar: 'ذاكرة 16GB تجريبية · بيان تطوير',
    },
    price: ils(429000),
    compareAtPrice: null,
    badges: ['new'],
    developmentFixture: true,
  },
  {
    id: 'p-novent-phone-67',
    slug: 'novent-phone-67',
    categorySlug: 'smartphones',
    brandId: 'novent',
    name: { he: 'סמארטפון 6.7 אינץ׳', ar: 'هاتف ذكي 6.7 إنش' },
    highlight: {
      he: 'מסך לדוגמה · 128GB · נתון פיתוח',
      ar: 'شاشة تجريبية · 128GB · بيان تطوير',
    },
    price: ils(189000),
    compareAtPrice: null,
    badges: ['bestseller', 'new'],
    developmentFixture: true,
  },
  {
    id: 'p-lumio-fridge-70',
    slug: 'lumio-fridge-70',
    categorySlug: 'refrigerators',
    brandId: 'lumio',
    name: { he: 'מקרר רטרו חד-דלתי', ar: 'ثلاجة ريترو بباب واحد' },
    highlight: {
      he: 'דלת אחת · תמונת המחשה · נתון פיתוח',
      ar: 'باب واحد · صورة توضيحية · بيان تطوير',
    },
    price: ils(529000),
    compareAtPrice: null,
    badges: ['new'],
    developmentFixture: true,
  },
  {
    id: 'p-ardent-tv-55',
    slug: 'ardent-tv-55',
    categorySlug: 'televisions',
    brandId: 'ardent',
    name: { he: 'טלוויזיה חכמה 55 אינץ׳', ar: 'تلفزيون ذكي 55 إنش' },
    highlight: {
      he: 'מסך 4K לדוגמה · נתון פיתוח',
      ar: 'شاشة 4K تجريبية · بيان تطوير',
    },
    price: ils(199000),
    compareAtPrice: ils(239000),
    badges: ['offer'],
    developmentFixture: true,
  },
  {
    id: 'p-novent-tv-50',
    slug: 'novent-tv-50',
    categorySlug: 'televisions',
    brandId: 'novent',
    name: { he: 'טלוויזיה חכמה 50 אינץ׳', ar: 'تلفزيون ذكي 50 إنش' },
    highlight: {
      he: 'מסך לדוגמה · נתון פיתוח',
      ar: 'شاشة تجريبية · بيان تطوير',
    },
    price: ils(169000),
    compareAtPrice: null,
    badges: ['new'],
    developmentFixture: true,
  },
  {
    id: 'p-lumio-cooktop-60',
    slug: 'lumio-cooktop-60',
    categorySlug: 'cooktops',
    brandId: 'lumio',
    name: { he: 'כיריים גז 60 ס״מ', ar: 'فرن غاز مسطح 60 سم' },
    highlight: {
      he: 'משטח גז לדוגמה · נתון פיתוח',
      ar: 'سطح غاز تجريبي · بيان تطوير',
    },
    price: ils(129000),
    compareAtPrice: null,
    badges: ['new'],
    developmentFixture: true,
  },
];

export type DemoImageKind = 'photo' | 'placeholder';

/** Local catalog image. `sort` ascending is the gallery order; the first image is primary. */
export type DemoProductImage = {
  src: string;
  alt: LocalizedText;
  sort: number;
  kind: DemoImageKind;
};

function photo(src: string, he: string, ar: string, sort = 0): DemoProductImage {
  return { src, alt: { he, ar }, sort, kind: 'photo' };
}

function placeholder(src: string, he: string, ar: string, sort = 0): DemoProductImage {
  return { src, alt: { he, ar }, sort, kind: 'placeholder' };
}

const genericTv = placeholder(
  '/catalog/vis-tv.webp',
  'איור טלוויזיה על רקע לבן. אינו תצלום של הדגם ואינו מייצג את גודל המסך.',
  'رسم تلفزيون على خلفية بيضاء. ليس صورة للطراز ولا يمثل مقاس الشاشة.',
);

/** Card and gallery images. Not photographs of the fictional brands. */
const productImageSets: Record<string, DemoProductImage[]> = {
  'p-solara-fridge-580': [
    placeholder(
      '/catalog/vis-fridge.webp',
      'איור מקרר על רקע לבן. אינו תצלום של דגם Solara.',
      'رسم ثلاجة على خلفية بيضاء. ليس صورة لطراز Solara.',
    ),
  ],
  'p-lumio-fridge-70': [
    photo(
      '/catalog/product-fridge-retro.webp',
      'תצלום מקרר חד-דלתי ישן על רקע בהיר. אינו דגם Lumio.',
      'صورة لثلاجة قديمة بباب واحد على خلفية فاتحة. ليست طراز Lumio.',
    ),
  ],
  'p-tekora-washer-9': [
    placeholder(
      '/catalog/vis-washer.webp',
      'איור מכונת כביסה על רקע לבן. אינו תצלום של דגם Tekora.',
      'رسم غسالة على خلفية بيضاء. ليس صورة لطراز Tekora.',
    ),
  ],
  'p-briza-dryer-8': [
    placeholder(
      '/catalog/vis-dryer.webp',
      'איור מייבש כביסה על רקע לבן. אינו תצלום של דגם Briza.',
      'رسم مجفف ملابس على خلفية بيضاء. ليس صورة لطراز Briza.',
    ),
  ],
  'p-novent-tv-65': [genericTv],
  'p-ardent-tv-55': [genericTv],
  'p-novent-tv-50': [genericTv],
  'p-lumio-oven-60': [
    placeholder(
      '/catalog/vis-oven.webp',
      'איור תנור על רקע לבן. אינו תצלום של דגם Lumio.',
      'رسم فرن على خلفية بيضاء. ليس صورة لطراز Lumio.',
    ),
  ],
  'p-lumio-cooktop-60': [
    placeholder(
      '/catalog/vis-cooktop.webp',
      'איור כיריים על רקע לבן. אינו תצלום של דגם Lumio.',
      'رسم موقد على خلفية بيضاء. ليس صورة لطراز Lumio.',
    ),
  ],
  'p-ardent-dishwasher-14': [
    placeholder(
      '/catalog/vis-dishwasher.webp',
      'איור מדיח כלים על רקע לבן. אינו תצלום של דגם Ardent.',
      'رسم جلاية صحون على خلفية بيضاء. ليس صورة لطراز Ardent.',
    ),
  ],
  'p-briza-ac-15': [
    placeholder(
      '/catalog/vis-ac.webp',
      'איור יחידת מזגן פנימית על רקע לבן. אינו תצלום של דגם Briza.',
      'رسم وحدة مكيف داخلية على خلفية بيضاء. ليس صورة لطراز Briza.',
    ),
  ],
  'p-solara-mixer-1200': [
    placeholder(
      '/catalog/vis-mixer.webp',
      'איור מיקסר על רקע לבן. אינו תצלום של דגם Solara.',
      'رسم عجانة على خلفية بيضاء. ليس صورة لطراز Solara.',
    ),
  ],
  'p-tekora-laptop-16': [
    photo(
      '/catalog/product-laptop.webp',
      'תצלום מחשב נייד כללי על רקע לבן. אינו דגם Tekora ואינו מאשר מסך של 16 אינץ׳.',
      'صورة عامة لحاسوب محمول على خلفية بيضاء. ليست طراز Tekora ولا تؤكد شاشة 16 إنش.',
    ),
  ],
  'p-novent-phone-67': [
    placeholder(
      '/catalog/vis-phone.webp',
      'איור טלפון על רקע לבן. אינו תצלום של דגם Novent.',
      'رسم هاتف على خلفية بيضاء. ليس صورة لطراز Novent.',
    ),
  ],
};

export const categoryImages: Record<string, string> = {
  refrigerators: '/catalog/vis-fridge.webp',
  'washing-machines': '/catalog/vis-washer.webp',
  dryers: '/catalog/vis-dryer.webp',
  televisions: '/catalog/vis-tv.webp',
  ovens: '/catalog/vis-oven.webp',
  cooktops: '/catalog/vis-cooktop.webp',
  dishwashers: '/catalog/vis-dishwasher.webp',
  'air-conditioners': '/catalog/vis-ac.webp',
  'small-appliances': '/catalog/vis-mixer.webp',
  computers: '/catalog/product-laptop.webp',
  smartphones: '/catalog/vis-phone.webp',
};

/**
 * Values copied from the existing demo name or highlight.
 * Missing specs stay absent so filters cannot invent them.
 */
export type DemoAttributes = {
  refrigeratorType?: 'single-door' | 'bottom-freezer';
  freezerPosition?: 'bottom';
  doors?: number;
  screenInches?: number;
  resolution?: '4k';
  smartTv?: boolean;
  capacityKg?: number;
  loadType?: 'front';
  spinRpm?: number;
};

const productAttributes: Record<string, DemoAttributes> = {
  'p-solara-fridge-580': { refrigeratorType: 'bottom-freezer', freezerPosition: 'bottom' },
  'p-lumio-fridge-70': { refrigeratorType: 'single-door', doors: 1 },
  'p-tekora-washer-9': { capacityKg: 9, loadType: 'front', spinRpm: 1400 },
  'p-novent-tv-65': { screenInches: 65, resolution: '4k', smartTv: true },
  'p-ardent-tv-55': { screenInches: 55, resolution: '4k' },
  'p-novent-tv-50': { screenInches: 50 },
};

export type ProductDetail = {
  label: LocalizedText;
  value: LocalizedText;
};

export type ProductDetails = {
  spec: ProductDetail[];
  features: ProductDetail[];
  info: ProductDetail[];
};

export type StoreSubcategory = {
  id: string;
  name: LocalizedText;
  image: string;
};

export type StoreCategory = CatalogCategory & {
  image?: string;
  subcategories?: StoreSubcategory[];
};

export type StoreOption = {
  id: string;
  sku: string;
  label: string;
  subcategoryId: string;
  price: { amountMinor: number; currency: 'ILS' };
  screenInches?: number;
  details: ProductDetails;
};

export type DemoProduct = CatalogProduct & {
  images: DemoProductImage[];
  attributes: DemoAttributes;
  details: ProductDetails;
  subcategoryId?: string;
  options?: StoreOption[];
};

export function productOptions(product: DemoProduct): StoreOption[] {
  return product.options ?? [];
}

export function listedOption(product: DemoProduct, params: URLSearchParams): StoreOption | undefined {
  const options = productOptions(product);
  const sub = params.get('sub');
  if (sub) {
    const match = options.find((option) => option.subcategoryId === sub);
    if (match) return match;
  }
  const screens = (params.get('screen') ?? '').split(',').filter(Boolean);
  if (screens.length === 0) return undefined;
  return options.find((option) => option.screenInches !== undefined && screens.includes(String(option.screenInches)));
}

export function optionModel(option: StoreOption | undefined): string {
  if (!option) return '';
  const rows = [...option.details.features, ...option.details.spec, ...option.details.info];
  const row = rows.find((item) => item.label.he.replace(/[״"'׳]/g, '') === 'דגם');
  const value = row?.value.he.trim() ?? '';
  return value.match(/[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/)?.[0] ?? value;
}

export function optionTitle(name: string, option: StoreOption | undefined): string {
  if (!option) return name;
  const size = option.label.match(/(\d{2,3})/)?.[1] ?? (option.screenInches ? String(option.screenInches) : '');
  const model = optionModel(option);
  let next = name.trim();
  if (model && /[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/.test(next)) {
    next = next.replace(/[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{4,}/, model);
  }
  if (size && /\d{2,3}\s*(?:אינץ|بوصة|inch|"|″|״)/i.test(next)) {
    next = next.replace(/\d{2,3}(?=\s*(?:אינץ|بوصة|inch|"|″|״))/i, size);
  } else if (size && /\b4K\b/i.test(next)) {
    next = next.replace(/\b4K\b/i, `${size}" 4K`);
  } else if (size && !new RegExp(`(?<!\\d)${size}(?!\\d)`).test(next)) {
    next = `${next} ${size}"`;
  }
  return next.replace(/\s{2,}/g, ' ').trim();
}

export function optionName(name: string, option: StoreOption | undefined): string {
  const title = optionTitle(name, option);
  const model = optionModel(option);
  if (!model || title.includes(model)) return title;
  return `${title} ${model}`;
}

export function optionById(product: DemoProduct, variantId = ''): StoreOption | undefined {
  const options = productOptions(product);
  return options.find((option) => option.id === variantId) ?? options[0];
}

export function lineAmount(product: DemoProduct, variantId = ''): number {
  return optionById(product, variantId)?.price.amountMinor ?? product.price.amountMinor;
}

const fallbackImage: DemoProductImage = placeholder(
  '/catalog/fallback.webp',
  'אין תמונת מוצר',
  'لا توجد صورة للمنتج',
);

const demoProducts: DemoProduct[] = products.map((product) => ({
  ...product,
  images: productImageSets[product.id] ?? [fallbackImage],
  attributes: productAttributes[product.id] ?? {},
  details: { spec: [], features: [], info: [] },
}));

export function orderedImages(product: DemoProduct): DemoProductImage[] {
  return [...product.images].sort((a, b) => a.sort - b.sort || a.src.localeCompare(b.src));
}

export function primaryImage(product: DemoProduct): DemoProductImage {
  return orderedImages(product)[0] ?? fallbackImage;
}

export type StoreCatalog = {
  isDevelopmentFixture: boolean;
  categories: StoreCategory[];
  brands: CatalogBrand[];
  products: DemoProduct[];
};

export const developmentCatalog: StoreCatalog = {
  isDevelopmentFixture: true,
  categories,
  brands,
  products: demoProducts,
};

export const emptyStoreCatalog: StoreCatalog = {
  isDevelopmentFixture: false,
  categories: [],
  brands: [],
  products: [],
};

let liveCatalog: StoreCatalog = emptyStoreCatalog;

export function activeCatalog(): StoreCatalog {
  return liveCatalog;
}

export function setActiveCatalog(next: StoreCatalog) {
  liveCatalog = next;
}

export function categoryBySlug(slug: string): StoreCategory | undefined {
  return liveCatalog.categories.find((category) => category.slug === slug);
}

export function brandById(id: string): CatalogBrand | undefined {
  return liveCatalog.brands.find((brand) => brand.id === id);
}

export function productBySlug(slug: string): DemoProduct | undefined {
  return liveCatalog.products.find((product) => product.slug === slug);
}

export function productById(id: string): DemoProduct | undefined {
  return liveCatalog.products.find((product) => product.id === id);
}

export function productsInCategory(slug: string): DemoProduct[] {
  return liveCatalog.products.filter((product) => product.categorySlug === slug);
}

export function productsWithBadge(badge: ProductBadge): DemoProduct[] {
  return liveCatalog.products.filter((product) => product.badges.includes(badge));
}

export function productsByIds(ids: readonly string[]): DemoProduct[] {
  return ids.flatMap((id) => {
    const product = productById(id);
    return product ? [product] : [];
  });
}

export function categoryImage(slug: string): string {
  const saved = liveCatalog.categories.find((category) => category.slug === slug)?.image;
  if (saved) return saved;
  return (
    categoryImages[slug] ??
    productsInCategory(slug)[0]?.images[0]?.src ??
    '/catalog/fallback.webp'
  );
}

export function searchProducts(query: string): DemoProduct[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return liveCatalog.products.filter((product) => {
    const brand = brandById(product.brandId)?.name ?? '';
    const category = categoryBySlug(product.categorySlug);
    const haystack = [
      product.name.he,
      product.name.ar,
      product.highlight.he,
      product.highlight.ar,
      brand,
      category?.name.he ?? '',
      category?.name.ar ?? '',
      product.slug,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });
}
