import { ar } from './ar';
import { he } from './he';
import { useLocaleStore } from '@/stores/locale-store';

export function useI18n() {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const messages = locale === 'ar' ? ar : he;
  return { locale, setLocale, messages };
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined ? '' : String(value);
  });
}
