import { useParams } from 'react-router-dom';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { CategoryLandingPage } from '@/components/category/CategoryLandingPage';
import { Container } from '@/components/ui/Container';
import { StatusPage } from '@/components/ui/StatusPage';
import { useI18n } from '@/i18n';

export function CategoryPage() {
  const { messages, locale } = useI18n();
  const { slug = '' } = useParams();
  const { data } = useDevelopmentCatalog();
  const category = data.categories.find((item) => item.slug === slug);
  usePageTitle(category?.name[locale] ?? messages.category.missingTitle);

  if (!category) {
    return (
      <StatusPage title={messages.category.missingTitle} body={messages.category.missingBody} />
    );
  }

  const products = data.products.filter((product) => product.categorySlug === category.slug);

  return (
    <Container>
      <CategoryLandingPage category={category} products={products} />
    </Container>
  );
}
