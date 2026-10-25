import type { BrandProfile } from '@/data/listing';
import { categoryFilter } from '@/data/listing';
import type { DemoProduct } from '@/data/catalog';
import { useI18n } from '@/i18n';
import { ProductListing } from '@/components/listing/ProductListing';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';
import { BrandHero } from './BrandHero';
import { BrandSubcategoryRow } from './BrandSubcategoryRow';

const priceFilter = {
  kind: 'price' as const,
  param: 'price' as const,
  label: { he: 'טווח מחיר', ar: 'نطاق السعر' },
};

export function BrandLandingPage({
  brand,
  products,
}: {
  brand: BrandProfile;
  products: readonly DemoProduct[];
}) {
  const { messages } = useI18n();
  const filters = [categoryFilter(brand.categorySlugs), priceFilter];

  return (
    <div className="py-6">
      <Breadcrumbs
        items={[
          { label: messages.common.home, to: '/' },
          { label: messages.brandPage.crumb, to: '/#brands' },
          { label: brand.name },
        ]}
      />
      <BrandHero brand={brand} />
      <BrandSubcategoryRow brandSlug={brand.slug} products={products} />
      <section className="mt-8">
        <h2 className="mb-4 text-center text-lg font-bold text-ink">{messages.brandPage.all}</h2>
        <ProductListing products={products} filters={filters} />
      </section>
    </div>
  );
}
