import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const maxQuantity = 10;

export type CartLine = {
  productId: string;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  couponCode: string;
  note: string;
  hydrated: boolean;
  add: (productId: string) => 'added' | 'max';
  setQuantity: (productId: string, quantity: number) => 'updated' | 'max';
  remove: (productId: string) => void;
  setCouponCode: (couponCode: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      couponCode: '',
      note: '',
      hydrated: false,
      add: (productId) => {
        const existing = get().lines.find((line) => line.productId === productId);
        if (existing && existing.quantity >= maxQuantity) return 'max';
        set((state) => {
          if (!existing) return { lines: [...state.lines, { productId, quantity: 1 }] };
          return {
            lines: state.lines.map((line) =>
              line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
            ),
          };
        });
        return 'added';
      },
      setQuantity: (productId, quantity) => {
        const existing = get().lines.find((line) => line.productId === productId);
        if (existing && quantity > maxQuantity) return 'max';
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((line) => line.productId !== productId)
              : state.lines.map((line) =>
                  line.productId === productId ? { ...line, quantity } : line,
                ),
        }));
        return 'updated';
      },
      remove: (productId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.productId !== productId),
        })),
      setCouponCode: (couponCode) => set({ couponCode }),
      setNote: (note) => set({ note }),
      clear: () => set({ lines: [], couponCode: '', note: '' }),
    }),
    {
      name: 'anan-cart',
      partialize: (state) => ({ lines: state.lines, couponCode: state.couponCode, note: state.note }),
    },
  ),
);

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
