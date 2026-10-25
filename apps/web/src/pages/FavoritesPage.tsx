import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Container } from '@/components/ui/Container';
import { useI18n } from '@/i18n';
import { useFavoritesStore } from '@/stores/favorites-store';

export function FavoritesPage() {
  const { messages } = useI18n();
  usePageTitle(messages.favorites.title);
  const { data } = useDevelopmentCatalog();
  const ids = useFavoritesStore((state) => state.ids);
  const products = data.products.filter((product) => ids.includes(product.id));

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-bold text-ink">{messages.favorites.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{messages.favorites.intro}</p>
      <div className="mt-6">
        {products.length === 0 ? (
          <p className="border border-line bg-white px-4 py-10 text-center text-sm text-muted">
            {messages.favorites.empty}
          </p>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </Container>
  );
}
