import { formatMoney, ils } from '@anan/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { primaryImage, productById, productOptions } from '@/data/catalog';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { HomeAds } from '@/components/home/HomeAds';
import { ProductGrid } from '@/components/product/ProductGrid';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/i18n';
import { Container } from '@/components/ui/Container';
import { apiBase } from '@/lib/api-url';

type StorePackage = {
  id: string;
  name: { he: string; ar: string };
  priceMinor: number;
  productIds: string[];
};

const apiUrl = apiBase();

export function PackagesPage() {
  const { locale, messages } = useI18n();
  const copy = messages.packages;
  const [packages, setPackages] = useState<StorePackage[] | null>(null);
  const { data } = useDevelopmentCatalog();
  const marked = data.products.filter((product) => productOptions(product).some((option) => option.inPackages));
  usePageTitle(copy.title);

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/api/packages`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((body: { packages: StorePackage[] }) => {
        if (active) setPackages(body.packages);
      })
      .catch(() => {
        if (active) setPackages([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Container className="py-8">
      <HomeAds placement="packages" />
      <h1 className="mt-8 text-3xl font-extrabold text-ink">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.note}</p>
      {packages === null ? <p className="mt-8 text-sm text-muted">{messages.common.loading}</p> : null}
      {packages?.length === 0 && marked.length === 0 ? <p className="mt-8 text-sm text-ink">{copy.empty}</p> : null}
      {marked.length > 0 ? (
        <div className="mt-8">
          <ProductGrid products={marked} />
        </div>
      ) : null}
      <div className="mt-8 space-y-6">
        {packages?.map((item) => {
          const products = item.productIds.flatMap((id) => {
            const product = productById(id);
            return product ? [product] : [];
          });
          return (
            <section id={item.id} key={item.id} className="scroll-mt-28 rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-extrabold text-ink">{item.name[locale]}</h2>
                <p className="shrink-0 text-xl font-extrabold tabular-nums text-ink">{formatMoney(ils(item.priceMinor), locale)}</p>
              </div>
              <p className="mt-4 text-sm font-bold text-ink">{copy.includes}</p>
              <ul className="mt-3 divide-y divide-line">
                {products.map((product) => {
                  const image = primaryImage(product);
                  return (
                    <li key={product.id} className="flex items-center gap-3 py-3">
                      <img src={image.src} alt={image.alt[locale]} className="h-16 w-16 object-contain" />
                      <Link to={`/product/${product.slug}`} className="min-w-0 flex-1 font-semibold text-ink hover:text-brand-blue">
                        {product.name[locale]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Container>
  );
}
