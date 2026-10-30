import type { DemoProduct } from '@/data/catalog';
import { useI18n } from '@/i18n';
import { ProductCard } from './ProductCard';

type ProductGridProps = {
  products: readonly DemoProduct[];
};

/**
 * Column count follows the viewport, not the number of products.
 * A short section keeps the same track width and leaves the extra tracks empty,
 * so two cards stay compact and sit at the RTL start instead of stretching.
 */
const gridColumns =
  'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 retail:grid-cols-6';

export function ProductGrid({ products }: ProductGridProps) {
  const { messages } = useI18n();

  if (products.length === 0) {
    return (
      <p className="border border-dashed border-line bg-white px-4 py-10 text-center text-sm text-muted">
        {messages.product.empty}
      </p>
    );
  }

  return (
    <ul className={`grid items-stretch gap-3 lg:gap-4 ${gridColumns}`}>
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
