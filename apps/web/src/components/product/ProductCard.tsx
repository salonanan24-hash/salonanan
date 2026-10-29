import { useState } from 'react';
import { Heart, Scale, ShoppingCart } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { brandById, listedOption, optionTitle, primaryImage, productOptions, type DemoProduct } from '@/data/catalog';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
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
  const [params] = useSearchParams();
  const { data } = useDevelopmentCatalog();
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
  const focus = listedOption(product, params);
  const category = data.categories.find((item) => item.slug === product.categorySlug);
  const subcategory = category?.subcategories?.find((item) => item.id === focus?.subcategoryId);
  const name = focus ? optionTitle(product.name[locale], focus) : product.name[locale];
  const detail = subcategory?.name[locale] || product.highlight[locale];
  const price = focus?.price ?? product.price;
  const href = focus?.sku ? `/product/${product.slug}/${encodeURIComponent(focus.sku)}` : `/product/${product.slug}`;
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
        <Link to={href} className="absolute inset-0 z-0">
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
        <Link to={href} tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-0" />
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
        <p className={`line-clamp-1 text-[11px] leading-4 ${copy('text-muted')}`}>{detail}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PriceDisplay
            price={price}
            compareAt={product.compareAtPrice}
            reserveCompare
            compact
            labelClassName={copy('')}
          />
          <button
            type="button"
            onMouseEnter={() => setCartHot(true)}
            onMouseLeave={() => setCartHot(false)}
            onClick={() => {
              const cheapest = [...productOptions(product)].sort((left, right) => left.price.amountMinor - right.price.amountMinor)[0];
              pushToast(add(product.id, focus?.id ?? cheapest?.id ?? '') === 'max' ? 'cartMax' : 'cartAdded');
            }}
            className="pointer-events-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-brand-blue bg-white px-2.5 text-xs font-bold text-brand-blue transition duration-200 hover:border-brand-blue hover:bg-brand-blue hover:text-white sm:h-8 sm:gap-1.5 sm:px-3 sm:text-[13px]"
          >
            <span>{inCart ? messages.product.inCart : messages.product.addShort}</span>
            <ShoppingCart className="size-3.5 sm:size-4" aria-hidden="true" />
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
