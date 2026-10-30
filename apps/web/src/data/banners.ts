import type { LocalizedText } from '@anan/shared';

/**
 * Development promotional banners.
 * The shape is the storefront contract for a future admin-managed banners table.
 * Copy must stay marked as demo data and must not promise a discount or a delivery time.
 */
export type PromoBanner = {
  id: string;
  placement: 'main' | 'side';
  image: string;
  imageAlt: LocalizedText;
  eyebrow: LocalizedText;
  title: LocalizedText;
  body: LocalizedText;
  ctaLabel: LocalizedText;
  href: string;
  demo: true;
};

export const promoBanners: readonly PromoBanner[] = [
  {
    id: 'banner-kitchen',
    placement: 'main',
    image: '/catalog/vis-oven.webp',
    imageAlt: {
      he: 'איור תנור על רקע לבן. אינו דגם מהמלאי.',
      ar: 'رسم فرن على خلفية بيضاء. ليس طرازًا من المخزون.',
    },
    eyebrow: { he: 'סלון ענאן', ar: 'معرض عنان' },
    title: { he: 'מוצרי חשמל למטבח', ar: 'أجهزة كهربائية للمطبخ' },
    body: {
      he: 'תנורים, כיריים ומדיחים מנתוני ההדגמה. התמונה אינה דגם מהמלאי.',
      ar: 'أفران ومواقد وجلايات من بيانات العرض. الصورة ليست طرازًا من المخزون.',
    },
    ctaLabel: { he: 'לקטגוריות', ar: 'إلى الفئات' },
    href: '#categories',
    demo: true,
  },
  {
    id: 'banner-living',
    placement: 'main',
    image: '/catalog/vis-tv.webp',
    imageAlt: {
      he: 'איור טלוויזיה על רקע לבן. אינו דגם מהמלאי.',
      ar: 'رسم تلفزيون على خلفية بيضاء. ليس طرازًا من المخزون.',
    },
    eyebrow: { he: 'הדגמה', ar: 'عرض تجريبي' },
    title: { he: 'טלוויזיה ובידור', ar: 'تلفزيون وترفيه' },
    body: {
      he: 'מסכים חכמים מנתוני הפיתוח. אין כאן מבצע פעיל.',
      ar: 'شاشات ذكية من بيانات التطوير. لا يوجد عرض فعّال هنا.',
    },
    ctaLabel: { he: 'לטלוויזיות', ar: 'إلى التلفزيونات' },
    href: '/category/televisions',
    demo: true,
  },
  {
    id: 'banner-fridge',
    placement: 'main',
    image: '/catalog/vis-fridge.webp',
    imageAlt: {
      he: 'איור מקרר על רקע לבן. אינו דגם מהמלאי.',
      ar: 'رسم ثلاجة على خلفية بيضاء. ليس طرازًا من المخزون.',
    },
    eyebrow: { he: 'הדגמה', ar: 'عرض تجريبي' },
    title: { he: 'מקררים לבית', ar: 'ثلاجات للبيت' },
    body: {
      he: 'התמונה והמחיר הם נתוני המחשה בלבד.',
      ar: 'الصورة والسعر بيانات توضيحية فقط.',
    },
    ctaLabel: { he: 'למקררים', ar: 'إلى الثلاجات' },
    href: '/category/refrigerators',
    demo: true,
  },
  {
    id: 'banner-cooktop',
    placement: 'side',
    image: '/catalog/vis-cooktop.webp',
    imageAlt: { he: 'איור כיריים על רקע לבן', ar: 'رسم موقد على خلفية بيضاء' },
    eyebrow: { he: 'הדגמה', ar: 'عرض تجريبي' },
    title: { he: 'כיריים', ar: 'مواقد' },
    body: { he: 'לקטגוריית הכיריים', ar: 'إلى فئة المواقد' },
    ctaLabel: { he: 'לצפייה', ar: 'عرض' },
    href: '/category/cooktops',
    demo: true,
  },
  {
    id: 'banner-climate',
    placement: 'side',
    image: '/catalog/vis-ac.webp',
    imageAlt: { he: 'איור מזגן פנימי על רקע לבן', ar: 'رسم مكيف داخلي على خلفية بيضاء' },
    eyebrow: { he: 'הדגמה', ar: 'عرض تجريبي' },
    title: { he: 'מזגנים', ar: 'مكيفات' },
    body: { he: 'לקטגוריית המזגנים', ar: 'إلى فئة المكيفات' },
    ctaLabel: { he: 'לצפייה', ar: 'عرض' },
    href: '/category/air-conditioners',
    demo: true,
  },
];
