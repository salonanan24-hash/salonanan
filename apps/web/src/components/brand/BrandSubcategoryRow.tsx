import { Link } from 'react-router-dom';
import { categoryImage, type DemoProduct } from '@/data/catalog';
import type { BrandProfile } from '@/data/listing';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { useI18n } from '@/i18n';

export function BrandSubcategoryRow({
  brand,
  products,
}: {
  brand: BrandProfile;
  products: readonly DemoProduct[];
}) {
  const { locale, messages } = useI18n();
  const { data } = useDevelopmentCatalog();
  const slugs = new Set(products.map((product) => product.categorySlug));
  const categories = data.categories.filter((category) => slugs.has(category.slug));
  if (categories.length === 0) return null;

  return (
    <section className="mt-8" aria-label={messages.brandPage.categories}>
      <ul className="flex justify-center gap-3 overflow-x-auto pb-1">
        {categories.map((category) => (
          <li key={category.id} className="w-36 shrink-0 sm:w-40">
            <Link
              to={`/category/${category.slug}?brand=${encodeURIComponent(brand.slug)}`}
              className="flex h-full flex-col rounded-2xl border border-line bg-white p-3 hover:border-brand-blue"
            >
              <span className="flex h-28 items-center justify-center">
                <img src={category.image || categoryImage(category.slug)} alt="" className="h-full w-full object-contain" />
              </span>
              <span className="mt-2 line-clamp-2 text-center text-xs font-bold leading-4 text-ink">
                {category.name[locale]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
