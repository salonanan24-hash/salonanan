export const locales = ['he', 'ar'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'he';

export type TextDirection = 'rtl' | 'ltr';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Both launch locales are RTL. Keep this function as the single place that decides direction. */
export function directionFor(locale: Locale): TextDirection {
  switch (locale) {
    case 'he':
    case 'ar':
      return 'rtl';
    default: {
      const exhaustive: never = locale;
      return exhaustive;
    }
  }
}
