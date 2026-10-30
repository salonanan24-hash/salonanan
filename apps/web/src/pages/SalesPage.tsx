import { productOptions } from '@/data/catalog';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Container } from '@/components/ui/Container';
import { useI18n } from '@/i18n';

export function SalesPage() {
  const { messages } = useI18n();
  const copy = messages.sales;
  usePageTitle(copy.title);
  const { data } = useDevelopmentCatalog();
  const products = data.products.filter((product) => productOptions(product).some((option) => option.onSale));

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-extrabold text-ink">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.note}</p>
      <div className="mt-8">
        {products.length === 0 ? (
          <p className="text-sm text-ink">{copy.empty}</p>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </Container>
  );
}
