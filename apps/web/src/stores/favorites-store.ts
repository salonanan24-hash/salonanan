import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type FavoritesState = {
  ids: string[];
  hydrated: boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,
      toggle: (productId) => {
        const ids = get().ids;
        set({
          ids: ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId],
        });
      },
      remove: (productId) => set({ ids: get().ids.filter((id) => id !== productId) }),
    }),
    {
      name: 'anan-favorites',
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
