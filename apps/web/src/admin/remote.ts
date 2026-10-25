import { getBrowserSupabase } from '@/lib/supabase';
import type { AdminData } from '@/admin/types';

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

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

export function loadCatalog() {
  return adminRequest<CatalogResponse>('/api/admin/catalog');
}

export function importCatalog(catalog: AdminData) {
  return adminRequest<CatalogResponse>('/api/admin/catalog/import', {
    method: 'POST',
    body: JSON.stringify(catalog),
  });
}
