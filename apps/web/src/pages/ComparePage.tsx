import { formatMoney } from '@anan/shared';
import { Link } from 'react-router-dom';
import { primaryImage } from '@/data/catalog';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { ProductImage } from '@/components/product/ProductImage';
import { Container } from '@/components/ui/Container';
import { useI18n } from '@/i18n';
import { useCompareStore } from '@/stores/compare-store';

export function ComparePage() {
  const { locale, messages } = useI18n();
  usePageTitle(messages.compare.title);
  const { data } = useDevelopmentCatalog();
  const ids = useCompareStore((state) => state.ids);
  const remove = useCompareStore((state) => state.remove);
  const products = ids
    .map((id) => data.products.find((product) => product.id === id))
    .filter((product) => product !== undefined);

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-bold text-ink">{messages.compare.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{messages.compare.intro}</p>
      <p className="mt-2 text-sm text-muted">{messages.compare.limit}</p>

      {products.length === 0 ? (
        <p className="mt-6 border border-line bg-white px-4 py-10 text-center text-sm text-muted">
          {messages.compare.empty}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="bg-canvas text-ink">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {messages.compare.product}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {messages.compare.highlight}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {messages.compare.price}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">{messages.compare.remove}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-line">
                  <th scope="row" className="px-4 py-4 text-start font-semibold">
                    <Link
                      to={`/product/${product.slug}`}
                      className="flex items-center gap-3 hover:text-brand-blue"
                    >
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-white">
                        <ProductImage
                          src={primaryImage(product).src}
                          alt={primaryImage(product).alt[locale]}
                          categorySlug={product.categorySlug}
                        />
                      </span>
                      {product.name[locale]}
                    </Link>
                  </th>
                  <td className="px-4 py-4 text-muted">{product.highlight[locale]}</td>
                  <td className="px-4 py-4 font-bold tabular-nums text-brand-red">
                    {formatMoney(product.price, locale)}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      className="font-semibold text-brand-red"
                    >
                      {messages.compare.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
