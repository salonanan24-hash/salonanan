import { useParams } from 'react-router-dom';
import { brandProfile } from '@/data/listing';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { BrandLandingPage } from '@/components/brand/BrandLandingPage';
import { Container } from '@/components/ui/Container';
import { StatusPage } from '@/components/ui/StatusPage';
import { useI18n } from '@/i18n';

export function BrandPage() {
  const { messages } = useI18n();
  const { slug = '' } = useParams();
  const { data } = useDevelopmentCatalog();
  const brand = brandProfile(slug);
  usePageTitle(brand?.name ?? messages.brandPage.missingTitle);

  if (!brand) {
    return (
      <StatusPage title={messages.brandPage.missingTitle} body={messages.brandPage.missingBody} />
    );
  }

  const products = brand.brandId
    ? data.products.filter((product) => product.brandId === brand.brandId)
    : [];

  return (
    <Container>
      <BrandLandingPage brand={brand} products={products} />
    </Container>
  );
}
