import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const compareLimit = 4;

export type CompareResult = 'added' | 'removed' | 'limit';

type CompareState = {
  ids: string[];
  hydrated: boolean;
  toggle: (productId: string) => CompareResult;
  remove: (productId: string) => void;
};

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      hydrated: false,
      toggle: (productId) => {
        const ids = get().ids;
        if (ids.includes(productId)) {
          set({ ids: ids.filter((id) => id !== productId) });
          return 'removed';
        }
        if (ids.length >= compareLimit) return 'limit';
        set({ ids: [...ids, productId] });
        return 'added';
      },
      remove: (productId) => set({ ids: get().ids.filter((id) => id !== productId) }),
    }),
    {
      name: 'anan-compare',
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
