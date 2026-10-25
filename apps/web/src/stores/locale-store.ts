import { defaultLocale, isLocale, type Locale } from '@anan/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

function readInitialLocale(): Locale {
  if (typeof localStorage === 'undefined') return defaultLocale;

  try {
    const raw = localStorage.getItem('anan-locale');
    if (!raw) return defaultLocale;
    const value: unknown = JSON.parse(raw).state.locale;
    return typeof value === 'string' && isLocale(value) ? value : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: readInitialLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'anan-locale',
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);
