import { adminEmails, formatMoney, ils } from '@anan/shared';
import { logger } from '../lib/logger.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js';
import { sendMail } from './send.js';

export type MailLocale = 'he' | 'ar';

export type MailStatus = 'placed' | 'processing' | 'ready' | 'shipping' | 'completed' | 'cancelled';

export type MailOrder = {
  number: string;
  placedAt: string;
  status: MailStatus;
  locale: MailLocale;
  subtotalMinor: number;
  discountMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  couponCode: string;
  note: string;
  deliveryMethod: 'pickup' | 'home';
  shippingZone: string;
  shippingAddress: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{
    name: { he: string; ar: string };
    quantity: number;
    lineTotalMinor: number;
  }>;
};

const storeName: Record<MailLocale, string> = {
  he: 'סלון ענאן',
  ar: 'صالون عنان',
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(minor: number, locale: MailLocale): string {
  return formatMoney(ils(minor), locale);
}

function when(iso: string, locale: MailLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  }).format(date);
}

const rtlStyle = 'direction:rtl;text-align:right;';

function page(locale: MailLocale, body: string): string {
  return `<!doctype html>
<html lang="${locale}" dir="rtl">
<body dir="rtl" style="margin:0;background:#f4f6f8;color:#172033;font-family:Arial,Helvetica,sans-serif;${rtlStyle}">
  <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;${rtlStyle}">
    <tr><td dir="rtl" align="center" style="padding:24px 12px;${rtlStyle}">
      <table dir="rtl" role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;${rtlStyle}">
        <tr><td dir="rtl" align="right" style="background:#0c5695;color:#ffffff;padding:18px 24px;font-size:20px;font-weight:700;${rtlStyle}">&#x200F;${esc(storeName[locale])}</td></tr>
        <tr><td dir="rtl" align="right" style="padding:24px;font-size:15px;line-height:1.7;${rtlStyle}">${body}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ltr(value: string): string {
  return `<span dir="ltr" style="direction:ltr;unicode-bidi:isolate;">${esc(value)}</span>`;
}

function text(value: string): string {
  return /[A-Za-z0-9@]/.test(value) ? ltr(value) : esc(value);
}

function paragraph(html: string, extra = 'margin:0 0 12px;'): string {
  return `<p dir="rtl" style="${extra}${rtlStyle}">&#x200F;${html}</p>`;
}

function greeting(locale: MailLocale, name: string): string {
  const safe = name.trim();
  if (locale === 'ar') return safe ? `مرحباً ${ltr(safe)}،` : 'مرحباً،';
  return safe ? `שלום ${ltr(safe)},` : 'שלום,';
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr>
    <td dir="rtl" align="right" style="padding:6px 0;color:#5c6775;${rtlStyle}">&#x200F;${esc(label)}</td>
    <td dir="rtl" align="left" style="padding:6px 0;font-weight:700;direction:rtl;text-align:left;">${text(value)}</td>
  </tr>`;
}

function linesTable(order: MailOrder, locale: MailLocale): string {
  const rows = order.items
    .map((item) => {
      const name = item.name[locale] || item.name.he;
      return `<tr>
        <td dir="rtl" align="right" style="padding:8px 0;border-bottom:1px solid #e5e7eb;${rtlStyle}">&#x200F;${esc(name)} × ${ltr(String(item.quantity))}</td>
        <td dir="ltr" align="left" style="padding:8px 0;border-bottom:1px solid #e5e7eb;direction:ltr;text-align:left;font-weight:700;">${ltr(money(item.lineTotalMinor, locale))}</td>
      </tr>`;
    })
    .join('');
  const deliveryLabel = order.deliveryMethod === 'pickup'
    ? locale === 'ar' ? 'الاستلام' : 'איסוף'
    : locale === 'ar' ? 'التوصيل' : 'משלוח';
  const deliveryValue = order.deliveryMinor === 0
    ? locale === 'ar' ? 'بدون تكلفة' : 'ללא עלות'
    : money(order.deliveryMinor, locale);
  return `<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse;${rtlStyle}">
    ${rows}
    ${row(locale === 'ar' ? 'المجموع' : 'סכום ביניים', money(order.subtotalMinor, locale))}
    ${order.discountMinor > 0 ? row(locale === 'ar' ? 'الخصم' : 'הנחה', money(order.discountMinor, locale)) : ''}
    ${row(deliveryLabel, deliveryValue)}
    ${row(locale === 'ar' ? 'الإجمالي' : 'סה״כ', money(order.totalMinor, locale))}
  </table>`;
}

function deliveryText(order: MailOrder, locale: MailLocale): string {
  if (order.deliveryMethod === 'pickup') return locale === 'ar' ? 'استلام ذاتي من المتجر' : 'איסוף עצמי מהחנות';
  return [locale === 'ar' ? 'توصيل حتى البيت' : 'משלוח עד הבית', order.shippingAddress].filter(Boolean).join(' — ');
}

function orderFacts(order: MailOrder, locale: MailLocale): string {
  return `<table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;${rtlStyle}">
    ${row(locale === 'ar' ? 'رقم الطلب' : 'מספר הזמנה', order.number)}
    ${row(locale === 'ar' ? 'التاريخ' : 'תאריך', when(order.placedAt, locale))}
    ${row(locale === 'ar' ? 'التسليم' : 'אספקה', deliveryText(order, locale))}
    ${order.shippingZone ? row(locale === 'ar' ? 'المنطقة' : 'אזור', order.shippingZone) : ''}
    ${order.couponCode ? row(locale === 'ar' ? 'قسيمة' : 'קופון', order.couponCode) : ''}
    ${order.note ? row(locale === 'ar' ? 'ملاحظة' : 'הערה', order.note) : ''}
  </table>
  ${linesTable(order, locale)}`;
}

const statusCopy: Record<MailStatus, Record<MailLocale, { subject: string; lead: string }>> = {
  placed: {
    he: { subject: 'ההזמנה {number} התקבלה', lead: 'ההזמנה שלך התקבלה ואנחנו מטפלים בה.' },
    ar: { subject: 'تم استلام الطلب {number}', lead: 'تم استلام طلبك ونحن نتابع معالجته.' },
  },
  processing: {
    he: { subject: 'ההזמנה {number} בטיפול', lead: 'ההזמנה שלך עברה לטיפול.' },
    ar: { subject: 'الطلب {number} قيد المعالجة', lead: 'طلبك أصبح قيد المعالجة.' },
  },
  ready: {
    he: { subject: 'ההזמנה {number} מוכנה לאיסוף', lead: 'ההזמנה שלך מוכנה לאיסוף עצמי מהחנות.' },
    ar: { subject: 'الطلب {number} جاهز للاستلام', lead: 'طلبك جاهز للاستلام الذاتي من المتجر.' },
  },
  shipping: {
    he: { subject: 'ההזמנה {number} בדרך אליך', lead: 'ההזמנה שלך יצאה למשלוח עד הבית.' },
    ar: { subject: 'الطلب {number} قيد التوصيل', lead: 'خرج طلبك للتوصيل حتى البيت.' },
  },
  completed: {
    he: { subject: 'ההזמנה {number} הושלמה', lead: 'ההזמנה שלך הושלמה. תודה שקנית בסלון ענאן.' },
    ar: { subject: 'اكتمل الطلب {number}', lead: 'اكتمل طلبك. شكراً لتسوقك من صالون عنان.' },
  },
  cancelled: {
    he: { subject: 'ההזמנה {number} בוטלה', lead: 'ההזמנה שלך בוטלה. אם זה לא מה שביקשת, אפשר להשיב למייל הזה.' },
    ar: { subject: 'أُلغي الطلب {number}', lead: 'تم إلغاء طلبك. إذا لم يكن هذا ما طلبته، يمكن الرد على هذا البريد.' },
  },
};

export async function sendWelcome(email: string, maxAgeMs = 30 * 60 * 1000): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const user = await findUser(email);
  if (!user?.email) return;
  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(created) || Date.now() - created > maxAgeMs) return;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta.welcome_sent === true) return;
  const locale: MailLocale = meta.preferred_locale === 'ar' ? 'ar' : 'he';
  const name = typeof meta.full_name === 'string' ? meta.full_name : '';
  const subject = locale === 'ar' ? 'أهلاً بك في صالون عنان' : 'ברוכים הבאים לסלון ענאן';
  const lead = locale === 'ar'
    ? 'يسعدنا انضمامك إلى صالون عنان. يمكنك تسجيل الدخول إلى الحساب، متابعة الطلبات وشراء أجهزة كهربائية للبيت.'
    : 'שמחים שהצטרפת לסלון ענאן. אפשר להיכנס לחשבון, לעקוב אחרי הזמנות ולקנות מוצרי חשמל לבית.';
  const ignore = locale === 'ar'
    ? 'إذا لم تقم بإنشاء الحساب، يمكن تجاهل هذه الرسالة.'
    : 'אם לא יצרת את החשבון, אפשר להתעלם מהמייל הזה.';
  const html = page(
    locale,
    `${paragraph(greeting(locale, name), 'margin:0 0 12px;font-size:18px;font-weight:700;')}
     ${paragraph(lead)}
     ${paragraph(ignore, 'margin:0;color:#5c6775;')}`,
  );
  const sent = await sendMail({ to: user.email, subject, html, fromName: storeName[locale] });
  if (!sent) return;
  const updated = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, welcome_sent: true },
  });
  if (updated.error) logger.warn('welcome flag was not saved');
}

export async function sendOrderPlaced(order: MailOrder): Promise<void> {
  const locale = order.locale;
  const subject = locale === 'ar' ? `تم استلام الطلب ${order.number}` : `ההזמנה ${order.number} התקבלה`;
  const lead = locale === 'ar'
    ? 'شكراً لطلبك من صالون عنان. استلمنا الطلب وسنرسل لك بريداً عند تغيّر حالته.'
    : 'תודה על ההזמנה בסלון ענאן. קיבלנו אותה ונשלח עדכון כשהסטטוס ישתנה.';
  const customerHtml = page(
    locale,
    `${paragraph(greeting(locale, order.customerName), 'margin:0 0 12px;font-size:18px;font-weight:700;')}
     ${paragraph(lead, 'margin:0;')}
     ${orderFacts(order, locale)}`,
  );
  const adminHtml = page(
    'he',
    `${paragraph('התקבלה הזמנה חדשה', 'margin:0 0 12px;font-size:18px;font-weight:700;')}
     <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${rtlStyle}">
       ${row('לקוח', order.customerName)}
       ${row('אימייל', order.customerEmail)}
       ${row('טלפון', order.customerPhone)}
       ${row('שפת האתר', locale === 'ar' ? 'ערבית' : 'עברית')}
     </table>
     ${orderFacts(order, 'he')}`,
  );
  await Promise.all([
    sendMail({ to: order.customerEmail, subject, html: customerHtml, fromName: storeName[locale] }),
    ...adminEmails.map((to) =>
      sendMail({ to, subject: `הזמנה חדשה ${order.number}`, html: adminHtml, fromName: storeName.he }),
    ),
  ]);
}

export async function sendPasswordCodeMail(email: string, code: string, locale: MailLocale): Promise<boolean> {
  const subject = locale === 'ar' ? 'رمز إعادة تعيين كلمة المرور' : 'קוד לאיפוס הסיסמה';
  const lead = locale === 'ar'
    ? 'استخدموا هذا الرمز لتعيين كلمة مرور جديدة في صالون عنان. الرمز صالح لمدة 5 دقائق.'
    : 'השתמשו בקוד הזה כדי לבחור סיסמה חדשה בסלון ענאן. הקוד תקף ל־5 דקות.';
  const html = page(
    locale,
    `${paragraph(lead, 'margin:0;')}
     <p dir="ltr" style="margin:20px 0 0;font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;direction:ltr;">${esc(code)}</p>`,
  );
  return sendMail({ to: email, subject, html, fromName: storeName[locale] });
}

export async function sendOrderStatus(order: MailOrder): Promise<void> {
  const locale = order.locale;
  const copy = statusCopy[order.status][locale];
  const numberLabel = locale === 'ar' ? 'رقم الطلب' : 'מספר הזמנה';
  const html = page(
    locale,
    `${paragraph(greeting(locale, order.customerName), 'margin:0 0 12px;font-size:18px;font-weight:700;')}
     ${paragraph(copy.lead, 'margin:0;')}
     <table dir="rtl" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;${rtlStyle}">
       ${row(numberLabel, order.number)}
     </table>`,
  );
  await sendMail({
    to: order.customerEmail,
    subject: copy.subject.replace('{number}', order.number),
    html,
    fromName: storeName[locale],
  });
}

async function findUser(email: string) {
  const target = email.trim().toLowerCase();
  for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
    const result = await getSupabaseAdmin().auth.admin.listUsers({ page: pageNumber, perPage: 200 });
    if (result.error) {
      logger.error('welcome lookup failed');
      return null;
    }
    const found = result.data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (result.data.users.length < 200) return null;
  }
  return null;
}
