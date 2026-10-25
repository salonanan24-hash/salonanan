import { Link } from 'react-router-dom';
import type { DemoProduct } from '@/data/catalog';
import { brandSubcategories, subcategoryHref } from '@/data/listing';
import { useI18n } from '@/i18n';

export function BrandSubcategoryRow({
  brandSlug,
  products,
}: {
  brandSlug: string;
  products: readonly DemoProduct[];
}) {
  const { locale, messages } = useI18n();
  const items = brandSubcategories(products);
  if (items.length === 0) return null;

  return (
    <section className="mt-8" aria-label={messages.brandPage.subcategories}>
      <ul className="flex justify-center gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <li key={item.id} className="w-36 shrink-0 sm:w-40">
            <Link
              to={subcategoryHref(brandSlug, item)}
              className="flex h-full flex-col rounded-2xl border border-line bg-white p-3 hover:border-brand-blue"
            >
              <span className="flex h-28 items-center justify-center">
                <img src={item.image} alt="" className="h-full w-full object-contain" />
              </span>
              <span className="mt-2 line-clamp-2 text-center text-xs font-bold leading-4 text-ink">
                {item.name[locale]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
