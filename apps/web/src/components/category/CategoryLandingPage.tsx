import { Link, useSearchParams } from 'react-router-dom';
import { brandById, categoryImage, type DemoProduct, type StoreCategory } from '@/data/catalog';
import {
  brandSubcategories,
  categoryLanding,
  listingFilters,
  type ProductSubcategory,
} from '@/data/listing';
import { useI18n } from '@/i18n';
import { ProductListing } from '@/components/listing/ProductListing';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';
import { BuyingGuideSection } from './BuyingGuideSection';

const subcategoryParams = ['type', 'screen', 'capacity'] as const;

export function CategoryLandingPage({
  category,
  products,
}: {
  category: StoreCategory;
  products: readonly DemoProduct[];
}) {
  const { locale, messages } = useI18n();
  const [params] = useSearchParams();
  const selectedSub = params.get('sub');
  const visible = selectedSub
    ? products.filter(
        (product) =>
          product.subcategoryId === selectedSub ||
          (product.options ?? []).some((option) => option.subcategoryId === selectedSub),
      )
    : products;
  const landing = categoryLanding(category.slug);
  const filters = listingFilters(category.slug, visible, selectedSub ?? '');
  const savedSubs = category.subcategories ?? [];
  const subcategories = savedSubs.length > 0 ? [] : brandSubcategories(products);
  const banner = category.image || categoryImage(category.slug);
  const brands = [...new Set(products.map((product) => product.brandId))].flatMap((id) => {
    const brand = brandById(id);
    return brand ? [brand] : [];
  });

  function subcategoryHref(item: ProductSubcategory) {
    const next = new URLSearchParams(params);
    next.delete('page');
    for (const key of subcategoryParams) next.delete(key);
    if (item.query) {
      const extra = new URLSearchParams(item.query);
      extra.forEach((value, key) => next.set(key, value));
    }
    const search = next.toString();
    return search ? `/category/${category.slug}?${search}` : `/category/${category.slug}`;
  }

  function subcategoryActive(item: ProductSubcategory) {
    if (!item.query) return subcategoryParams.every((key) => !params.get(key));
    const extra = new URLSearchParams(item.query);
    for (const [key, value] of extra) {
      if (params.get(key) !== value) return false;
    }
    return true;
  }

  return (
    <div className="py-6">
      <Breadcrumbs
        items={[{ label: messages.common.home, to: '/' }, { label: category.name[locale] }]}
      />
      <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{category.name[locale]}</h1>
      {category.description[locale] ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{category.description[locale]}</p>
      ) : null}
      {savedSubs.length > 0 ? (
        <ul className="mt-8 flex gap-3 overflow-x-auto px-1 py-3">
          {savedSubs.map((item) => {
            const active = selectedSub === item.id;
            return (
              <li key={item.id} className="w-36 shrink-0 sm:w-44">
                <Link
                  to={active ? `/category/${category.slug}` : `/category/${category.slug}?sub=${item.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={`group flex h-full flex-col items-center rounded-2xl border bg-white px-3 py-4 shadow-[0_8px_20px_rgb(23_32_51/0.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_28px_rgb(23_32_51/0.1)] ${
                    active ? 'border-brand-red' : 'border-line'
                  }`}
                >
                  <img src={item.image || banner} alt="" className="h-24 w-full object-contain sm:h-28" />
                  <span className="mt-3 line-clamp-2 text-center text-sm font-bold leading-5 text-ink transition-colors duration-300 group-hover:text-brand-red">
                    {item.name[locale]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {subcategories.length > 0 ? (
        <section className="mt-6" aria-label={messages.categoryPage.subcategories}>
          <ul className="flex gap-3 overflow-x-auto px-1 py-3">
            {subcategories.map((item) => {
              const active = subcategoryActive(item);
              return (
                <li key={item.id} className="w-36 shrink-0 sm:w-44">
                  <Link
                    to={subcategoryHref(item)}
                    aria-current={active ? 'true' : undefined}
                    className={`group flex h-full flex-col rounded-2xl border bg-white p-3 shadow-[0_8px_20px_rgb(23_32_51/0.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_28px_rgb(23_32_51/0.1)] ${
                      active ? 'border-brand-red' : 'border-line'
                    }`}
                  >
                    <span className="flex h-24 items-center justify-center">
                      <img src={item.image} alt="" className="h-full w-full object-contain" />
                    </span>
                    <span className="mt-2 line-clamp-2 text-center text-xs font-bold leading-4 text-ink transition-colors duration-300 group-hover:text-brand-red">
                      {item.name[locale]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {brands.length > 0 ? (
        <section className="mt-8 border-y border-line py-5" aria-label={messages.categoryPage.brands}>
          <ul className="flex items-center justify-evenly gap-x-8 gap-y-4 overflow-x-auto">
            {brands.map((brand) => (
              <li key={brand.id} className="shrink-0">
                <Link to={`/brands/${brand.slug}`} className="flex h-12 items-center justify-center">
                  {brand.image ? (
                    <img src={brand.image} alt={brand.name} className="h-10 w-auto max-w-36 object-contain" />
                  ) : (
                    <span className="text-lg font-black tracking-tight text-ink">{brand.name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-6">
        <ProductListing products={visible} filters={filters} />
      </div>
      {landing?.guide ? <BuyingGuideSection guide={landing.guide} /> : null}
    </div>
  );
}
