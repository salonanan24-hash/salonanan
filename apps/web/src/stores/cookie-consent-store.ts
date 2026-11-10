import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CookiePreferences = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
};

type CookieConsentState = {
  decided: boolean;
  open: boolean;
  preferences: CookiePreferences;
  hydrated: boolean;
  acceptAll: () => void;
  rejectOptional: () => void;
  savePreferences: (preferences: Pick<CookiePreferences, 'functional' | 'analytics'>) => void;
  openSettings: () => void;
  closeSettings: () => void;
};

const defaultPreferences: CookiePreferences = {
  necessary: true,
  functional: true,
  analytics: false,
};

export const useCookieConsentStore = create<CookieConsentState>()(
  persist(
    (set) => ({
      decided: false,
      open: false,
      preferences: defaultPreferences,
      hydrated: false,
      acceptAll: () =>
        set({
          decided: true,
          open: false,
          preferences: { necessary: true, functional: true, analytics: true },
        }),
      rejectOptional: () =>
        set({
          decided: true,
          open: false,
          preferences: { necessary: true, functional: true, analytics: false },
        }),
      savePreferences: (preferences) =>
        set({
          decided: true,
          open: false,
          preferences: { necessary: true, functional: preferences.functional, analytics: preferences.analytics },
        }),
      openSettings: () => set({ open: true }),
      closeSettings: () => set({ open: false }),
    }),
    {
      name: 'anan-cookie-consent',
      partialize: (state) => ({
        decided: state.decided,
        preferences: state.preferences,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export function analyticsAllowed(): boolean {
  return useCookieConsentStore.getState().preferences.analytics;
}
