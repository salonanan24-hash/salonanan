import { getBrowserSupabase } from '@/lib/supabase';
import { apiBase } from '@/lib/api-url';
import type { AdminData } from '@/admin/types';

const apiUrl = apiBase();

type CatalogResponse = {
  empty?: boolean;
  catalog: AdminData;
};

async function accessToken(): Promise<string> {
  const client = getBrowserSupabase();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error('unauthorized');
  return session.access_token;
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`admin ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fillProductFromLink(input: { model: string; notes: string; images: string[] }): Promise<{
  draft: {
    nameHe: string;
    nameAr: string;
    brandId: string;
    categoryId: string;
    subcategoryId: string;
    specs: Record<string, string>;
    specsAr: Record<string, string>;
    price: string;
    color: string;
    variants: Array<{
      label: string;
      sku: string;
      price: string;
      subcategoryId: string;
      specs: Record<string, string>;
      specsAr: Record<string, string>;
    }>;
  };
  created: { brand: string | null; category: string | null; subcategory: string | null; fields: string[] };
}> {
  const token = await accessToken();
  const response = await fetch(`${apiUrl}/api/admin/products/intake`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.code || 'agent_failed');
  return body as {
    draft: {
      nameHe: string;
      nameAr: string;
      brandId: string;
      categoryId: string;
      subcategoryId: string;
      specs: Record<string, string>;
      specsAr: Record<string, string>;
      price: string;
      color: string;
      variants: Array<{
        label: string;
        sku: string;
        price: string;
        subcategoryId: string;
        specs: Record<string, string>;
        specsAr: Record<string, string>;
      }>;
    };
    created: { brand: string | null; category: string | null; subcategory: string | null; fields: string[] };
  };
}

export function loadCatalog() {
  return adminRequest<CatalogResponse>('/api/admin/catalog');
}

export function importCatalog(catalog: AdminData) {
  return adminRequest<CatalogResponse>('/api/admin/catalog/import', {
    method: 'POST',
    body: JSON.stringify(catalog),
  });
}
