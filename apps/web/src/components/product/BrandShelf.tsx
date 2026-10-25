import { Link } from 'react-router-dom';
import type { DemoProduct } from '@/data/catalog';
import { ProductCard } from './ProductCard';

type BrandShelfProps = {
  title: string;
  href: string;
  actionLabel: string;
  products: readonly DemoProduct[];
};

export function BrandShelf({ title, href, actionLabel, products }: BrandShelfProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h2 className="text-2xl font-extrabold text-ink">{title}</h2>
        <Link to={href} className="text-sm font-bold text-brand-blue">
          {actionLabel}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-4">
        {products.map((product) => (
          <li key={product.id} className="w-[calc(50%-0.5rem)] sm:w-64">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
