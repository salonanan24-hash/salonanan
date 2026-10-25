import { useQuery } from '@tanstack/react-query';
import { emptyStoreCatalog, setActiveCatalog, type StoreCatalog } from '@/data/catalog';
import { apiBase } from '@/lib/api-url';

const apiUrl = apiBase();

async function fetchStoreCatalog(): Promise<StoreCatalog> {
  const response = await fetch(`${apiUrl}/api/catalog`);
  if (!response.ok) throw new Error('catalog');
  const data = (await response.json()) as StoreCatalog;
  if (!Array.isArray(data.categories) || !Array.isArray(data.brands) || !Array.isArray(data.products)) {
    throw new Error('catalog');
  }
  return data;
}

export function useDevelopmentCatalog() {
  const query = useQuery({
    queryKey: ['store-catalog'],
    queryFn: fetchStoreCatalog,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  if (query.data) setActiveCatalog(query.data);
  return {
    ...query,
    data: query.data ?? emptyStoreCatalog,
  };
}
