import { create } from 'zustand';
import { importCatalog, loadCatalog, adminRequest } from '@/admin/remote';
import { seedAdmin } from '@/admin/seed';
import type {
  AdminBrand,
  AdminCategory,
  AdminCoupon,
  AdminData,
  AdminField,
  FieldSection,
  AdminProduct,
  AdminSubcategory,
  FieldType,
  ShippingZone,
} from '@/admin/types';

export function nid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || nid('id');
}

type CategoryInput = {
  id?: string;
  slug: string;
  nameHe: string;
  nameAr: string;
  image: string;
};

type BrandInput = {
  id?: string;
  name: string;
  slug: string;
  image: string;
};

type AdminState = AdminData & {
  ready: boolean;
  loading: boolean;
  loadError: string;
  saveError: string;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  saveCategory: (input: CategoryInput) => Promise<void>;
  removeCategory: (id: string) => Promise<boolean>;
  saveSubcategory: (
    categoryId: string,
    input: { id?: string; nameHe: string; nameAr: string; image: string },
  ) => Promise<void>;
  removeSubcategory: (categoryId: string, subcategoryId: string) => Promise<void>;
  saveField: (
    categoryId: string,
    input: { id?: string; nameHe: string; nameAr: string; type: FieldType; section: FieldSection },
  ) => Promise<void>;
  removeField: (categoryId: string, fieldId: string) => Promise<void>;
  saveBrand: (input: BrandInput) => Promise<void>;
  removeBrand: (id: string) => Promise<boolean>;
  saveProduct: (product: AdminProduct) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  saveCoupon: (coupon: AdminCoupon) => Promise<void>;
  removeCoupon: (id: string) => Promise<void>;
  saveSettings: (patch: { phone?: string; zones?: ShippingZone[]; accent?: string }) => Promise<void>;
};

const emptySettings = { phone: '', zones: [] as ShippingZone[], accent: 'burgundy' };

let loadOnce: Promise<void> | null = null;

function uniqueSlug(wanted: string, currentId: string | undefined, ids: { id: string; slug: string }[]): string {
  const taken = new Set(ids.filter((item) => item.id !== currentId).map((item) => item.slug));
  let slug = wanted;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${wanted}-${n}`;
    n += 1;
  }
  return slug;
}

function readLocalAdmin(): AdminData | null {
  try {
    const raw = localStorage.getItem('anan-admin');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<AdminData> };
    const state = parsed.state;
    if (!state?.categories?.length && !state?.brands?.length && !state?.products?.length) return null;
    return {
      categories: state.categories ?? [],
      brands: state.brands ?? [],
      products: state.products ?? [],
      coupons: state.coupons ?? [],
      settings: {
        phone: state.settings?.phone ?? '',
        zones: state.settings?.zones ?? [],
        accent: state.settings?.accent || 'burgundy',
      },
    };
  } catch {
    return null;
  }
}

function conflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes('409');
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  categories: [],
  brands: [],
  products: [],
  coupons: [],
  settings: emptySettings,
  ready: false,
  loading: false,
  loadError: '',
  saveError: '',
  load: () => {
    if (get().ready) return Promise.resolve();
    if (!loadOnce) {
      loadOnce = (async () => {
        set({ loading: true, loadError: '' });
        try {
          const result = await loadCatalog();
          const catalog = result.empty ? (await importCatalog(readLocalAdmin() ?? seedAdmin())).catalog : result.catalog;
          if (result.empty) localStorage.removeItem('anan-admin');
          set({ ...catalog, ready: true, loading: false, loadError: '', saveError: '' });
        } catch {
          set({ loading: false, loadError: 'failed' });
          throw new Error('load');
        }
      })().finally(() => {
        if (!get().ready) loadOnce = null;
      });
    }
    return loadOnce;
  },
  refresh: async () => {
    const result = await loadCatalog();
    if (result.empty) return;
    set({ ...result.catalog, ready: true, loading: false, loadError: '', saveError: '' });
  },
  saveCategory: async (input) => {
    const nameHe = input.nameHe.trim();
    const nameAr = input.nameAr.trim() || nameHe;
    const slug = uniqueSlug(slugify(input.slug || nameHe), input.id, get().categories);
    const id = input.id ?? nid('cat');
    try {
      if (input.id) {
        await adminRequest(`/api/admin/categories/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ slug, nameHe, nameAr, image: input.image }),
        });
        set((state) => ({
          saveError: '',
          categories: state.categories.map((category) =>
            category.id === id
              ? { ...category, slug, name: { he: nameHe, ar: nameAr }, image: input.image }
              : category,
          ),
        }));
        return;
      }
      await adminRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ id, slug, nameHe, nameAr, image: input.image }),
      });
      const category: AdminCategory = {
        id,
        slug,
        name: { he: nameHe, ar: nameAr },
        image: input.image,
        subcategories: [],
        fields: [],
      };
      set((state) => ({ saveError: '', categories: [category, ...state.categories] }));
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
  },
  removeCategory: async (id) => {
    if (get().products.some((product) => product.categoryId === id)) return false;
    try {
      await adminRequest(`/api/admin/categories/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (conflict(error)) return false;
      set({ saveError: 'failed' });
      return false;
    }
    set((state) => ({
      saveError: '',
      categories: state.categories.filter((category) => category.id !== id),
    }));
    return true;
  },
  saveSubcategory: async (categoryId, input) => {
    const nameHe = input.nameHe.trim();
    const nameAr = input.nameAr.trim() || nameHe;
    const id = input.id ?? nid('sub');
    try {
      if (input.id) {
        await adminRequest(`/api/admin/subcategories/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nameHe, nameAr, image: input.image }),
        });
      } else {
        await adminRequest(`/api/admin/categories/${categoryId}/subcategories`, {
          method: 'POST',
          body: JSON.stringify({ id, nameHe, nameAr, image: input.image }),
        });
      }
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => ({
      saveError: '',
      categories: state.categories.map((category) => {
        if (category.id !== categoryId) return category;
        if (input.id) {
          return {
            ...category,
            subcategories: category.subcategories.map((item) =>
              item.id === id ? { ...item, name: { he: nameHe, ar: nameAr }, image: input.image } : item,
            ),
          };
        }
        const created: AdminSubcategory = { id, name: { he: nameHe, ar: nameAr }, image: input.image };
        return { ...category, subcategories: [...category.subcategories, created] };
      }),
    }));
  },
  removeSubcategory: async (categoryId, subcategoryId) => {
    try {
      await adminRequest(`/api/admin/subcategories/${subcategoryId}`, { method: 'DELETE' });
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => ({
      saveError: '',
      categories: state.categories.map((category) =>
        category.id === categoryId
          ? { ...category, subcategories: category.subcategories.filter((item) => item.id !== subcategoryId) }
          : category,
      ),
      products: state.products.map((product) =>
        product.subcategoryId === subcategoryId ? { ...product, subcategoryId: '' } : product,
      ),
    }));
  },
  saveField: async (categoryId, input) => {
    const nameHe = input.nameHe.trim();
    const nameAr = input.nameAr.trim() || nameHe;
    const id = input.id ?? nid('field');
    try {
      if (input.id) {
        await adminRequest(`/api/admin/fields/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nameHe, nameAr, type: input.type, section: input.section }),
        });
      } else {
        await adminRequest(`/api/admin/categories/${categoryId}/fields`, {
          method: 'POST',
          body: JSON.stringify({ id, nameHe, nameAr, type: input.type, section: input.section }),
        });
      }
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => ({
      saveError: '',
      categories: state.categories.map((category) => {
        if (category.id !== categoryId) return category;
        if (input.id) {
          return {
            ...category,
            fields: category.fields.map((item) =>
              item.id === id
                ? { ...item, label: { he: nameHe, ar: nameAr }, type: input.type, section: input.section }
                : item,
            ),
          };
        }
        const created: AdminField = {
          id,
          label: { he: nameHe, ar: nameAr },
          type: input.type,
          section: input.section,
        };
        return { ...category, fields: [...category.fields, created] };
      }),
    }));
  },
  removeField: async (categoryId, fieldId) => {
    try {
      await adminRequest(`/api/admin/fields/${fieldId}`, { method: 'DELETE' });
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => ({
      saveError: '',
      categories: state.categories.map((category) =>
        category.id === categoryId
          ? { ...category, fields: category.fields.filter((item) => item.id !== fieldId) }
          : category,
      ),
    }));
  },
  saveBrand: async (input) => {
    const name = input.name.trim();
    const slug = uniqueSlug(slugify(input.slug || name), input.id, get().brands);
    const id = input.id ?? nid('brand');
    try {
      if (input.id) {
        await adminRequest(`/api/admin/brands/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, slug, image: input.image }),
        });
        set((state) => ({
          saveError: '',
          brands: state.brands.map((brand) =>
            brand.id === id ? { ...brand, name, slug, image: input.image } : brand,
          ),
        }));
        return;
      }
      await adminRequest('/api/admin/brands', {
        method: 'POST',
        body: JSON.stringify({ id, name, slug, image: input.image }),
      });
      const brand: AdminBrand = { id, name, slug, image: input.image };
      set((state) => ({ saveError: '', brands: [brand, ...state.brands] }));
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
  },
  removeBrand: async (id) => {
    if (get().products.some((product) => product.brandId === id)) return false;
    try {
      await adminRequest(`/api/admin/brands/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (conflict(error)) return false;
      set({ saveError: 'failed' });
      return false;
    }
    set((state) => ({ saveError: '', brands: state.brands.filter((brand) => brand.id !== id) }));
    return true;
  },
  saveProduct: async (product) => {
    try {
      await adminRequest(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(product),
      });
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => {
      const exists = state.products.some((item) => item.id === product.id);
      return {
        saveError: '',
        products: exists
          ? state.products.map((item) => (item.id === product.id ? product : item))
          : [product, ...state.products],
      };
    });
  },
  removeProduct: async (id) => {
    try {
      await adminRequest(`/api/admin/products/${id}`, { method: 'DELETE' });
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => ({ saveError: '', products: state.products.filter((product) => product.id !== id) }));
  },
  saveCoupon: async (coupon) => {
    try {
      await adminRequest(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        body: JSON.stringify(coupon),
      });
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => {
      const exists = state.coupons.some((item) => item.id === coupon.id);
      return {
        saveError: '',
        coupons: exists
          ? state.coupons.map((item) => (item.id === coupon.id ? coupon : item))
          : [coupon, ...state.coupons],
      };
    });
  },
  removeCoupon: async (id) => {
    try {
      await adminRequest(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    } catch (error) {
      set({ saveError: 'failed' });
      throw error;
    }
    set((state) => ({ saveError: '', coupons: state.coupons.filter((coupon) => coupon.id !== id) }));
  },
  saveSettings: async (patch) => {
    const previous = get().settings;
    const next = {
      phone: patch.phone ?? previous.phone,
      zones: patch.zones ?? previous.zones,
      accent: patch.accent ?? previous.accent,
    };
    set({ settings: next, saveError: '' });
    try {
      await adminRequest('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
    } catch (error) {
      set({ settings: previous, saveError: 'failed' });
      throw error;
    }
  },
}));
