import { useState } from 'react';
import { Heart, Scale, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { brandById, primaryImage, type DemoProduct } from '@/data/catalog';
import { useI18n } from '@/i18n';
import { pushToast } from '@/components/ui/ActionToast';
import { useCartStore } from '@/stores/cart-store';
import { useCompareStore } from '@/stores/compare-store';
import { useFavoritesStore } from '@/stores/favorites-store';
import { PriceDisplay } from './PriceDisplay';
import { ProductImage } from './ProductImage';

type ProductCardProps = {
  product: DemoProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  const { locale, messages } = useI18n();
  const add = useCartStore((state) => state.add);
  const inCart = useCartStore((state) => state.lines.some((line) => line.productId === product.id));
  const favorite = useFavoritesStore((state) => state.ids.includes(product.id));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const compared = useCompareStore((state) => state.ids.includes(product.id));
  const toggleCompare = useCompareStore((state) => state.toggle);
  const [limitNote, setLimitNote] = useState(false);
  const [imageHot, setImageHot] = useState(false);
  const [cartHot, setCartHot] = useState(false);
  const brand = brandById(product.brandId);
  const image = primaryImage(product);
  const name = product.name[locale];
  const quiet = imageHot || cartHot;
  const copy = (resting: string) =>
    `transition-colors duration-200 ${resting}${quiet ? '' : ' group-hover/card:text-brand-red'}`;

  return (
    <article className="group/card relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white">
      <div className="relative z-10 flex h-full flex-col">
      <div
        className="relative bg-white"
        onMouseEnter={() => setImageHot(true)}
        onMouseLeave={() => setImageHot(false)}
      >
        <Link to={`/product/${product.slug}`} className="absolute inset-0 z-0">
          <span className="sr-only">{name}</span>
        </Link>
        <div className="pointer-events-none flex h-[172px] items-center justify-center overflow-hidden bg-white p-3 md:h-[188px]">
          <ProductImage
            src={image.src}
            alt={image.alt[locale]}
            categorySlug={product.categorySlug}
            className="h-full w-full object-contain transition duration-500 group-hover/card:scale-105"
          />
        </div>
      </div>
      <div className="relative flex flex-1 flex-col gap-1.5 px-3 pt-2.5 pb-3">
        <Link to={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-0" />
        <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          {brand?.image ? (
            <img src={brand.image} alt="" className="h-7 max-w-[48%] object-contain" />
          ) : (
            <p className={`truncate text-[11px] font-semibold leading-4 ${copy('text-brand-blue')}`}>{brand?.name}</p>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={favorite}
              aria-label={favorite ? messages.product.favoriteRemove : messages.product.favoriteAdd}
              onClick={() => toggleFavorite(product.id)}
              className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-ink transition duration-200 hover:scale-110 hover:border-brand-red hover:bg-[#fff1f1] hover:text-brand-red"
            >
              <Heart
                className="h-3.5 w-3.5"
                aria-hidden="true"
                fill={favorite ? '#e52629' : 'none'}
                color={favorite ? '#e52629' : 'currentColor'}
              />
            </button>
            <button
              type="button"
              aria-pressed={compared}
              aria-label={compared ? messages.product.compareRemove : messages.product.compareAdd}
              onClick={() => {
                const result = toggleCompare(product.id);
                setLimitNote(result === 'limit');
              }}
              className={`pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border bg-white transition duration-200 hover:scale-110 hover:border-brand-blue hover:bg-[#f3f8fc] hover:text-brand-blue ${
                compared ? 'border-brand-blue text-brand-blue' : 'border-line text-muted'
              }`}
            >
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <h3 className={`line-clamp-3 text-[13px] font-semibold leading-5 ${copy('text-ink')}`}>{name}</h3>
        <p className={`line-clamp-1 text-[11px] leading-4 ${copy('text-muted')}`}>{product.highlight[locale]}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceDisplay
            price={product.price}
            compareAt={product.compareAtPrice}
            reserveCompare
            compact
            labelClassName={copy('')}
          />
          <button
            type="button"
            onMouseEnter={() => setCartHot(true)}
            onMouseLeave={() => setCartHot(false)}
            onClick={() => pushToast(add(product.id) === 'max' ? 'cartMax' : 'cartAdded')}
            className="pointer-events-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-brand-blue bg-white px-3 text-[13px] font-bold text-brand-blue transition duration-200 hover:border-brand-blue hover:bg-brand-blue hover:text-white"
          >
            <span>{inCart ? messages.product.inCart : messages.product.addShort}</span>
            <ShoppingCart className="size-4" aria-hidden="true" />
          </button>
        </div>
        {limitNote ? (
          <p role="status" className="text-center text-[11px] leading-4 text-brand-red">
            {messages.product.compareLimit}
          </p>
        ) : null}
        </div>
      </div>
      </div>
    </article>
  );
}
