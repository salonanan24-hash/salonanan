import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const maxQuantity = 10;

export type CartLine = {
  productId: string;
  variantId?: string;
  quantity: number;
};

function sameLine(line: CartLine, productId: string, variantId = ''): boolean {
  return line.productId === productId && (line.variantId ?? '') === variantId;
}

type CartState = {
  lines: CartLine[];
  couponCode: string;
  note: string;
  hydrated: boolean;
  add: (productId: string, variantId?: string) => 'added' | 'max';
  setQuantity: (productId: string, quantity: number, variantId?: string) => 'updated' | 'max';
  remove: (productId: string, variantId?: string) => void;
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
      add: (productId, variantId = '') => {
        const existing = get().lines.find((line) => sameLine(line, productId, variantId));
        if (existing && existing.quantity >= maxQuantity) return 'max';
        set((state) => {
          if (!existing) return { lines: [...state.lines, { productId, variantId, quantity: 1 }] };
          return {
            lines: state.lines.map((line) =>
              sameLine(line, productId, variantId) ? { ...line, quantity: line.quantity + 1 } : line,
            ),
          };
        });
        return 'added';
      },
      setQuantity: (productId, quantity, variantId = '') => {
        const existing = get().lines.find((line) => sameLine(line, productId, variantId));
        if (existing && quantity > maxQuantity) return 'max';
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((line) => !sameLine(line, productId, variantId))
              : state.lines.map((line) =>
                  sameLine(line, productId, variantId) ? { ...line, quantity } : line,
                ),
        }));
        return 'updated';
      },
      remove: (productId, variantId = '') =>
        set((state) => ({
          lines: state.lines.filter((line) => !sameLine(line, productId, variantId)),
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
