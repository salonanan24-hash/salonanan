import { useEffect, useRef, useState } from 'react';
import { Heart, Scale } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { orderedImages, primaryImage } from '@/data/catalog';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ProductImage } from '@/components/product/ProductImage';
import { Container } from '@/components/ui/Container';
import { DevNotice } from '@/components/ui/DevNotice';
import { StatusPage } from '@/components/ui/StatusPage';
import { fill, useI18n } from '@/i18n';
import { BrandShelf } from '@/components/product/BrandShelf';
import { pushToast } from '@/components/ui/ActionToast';
import { useCartStore } from '@/stores/cart-store';
import { useCompareStore } from '@/stores/compare-store';
import { useFavoritesStore } from '@/stores/favorites-store';

export function ProductPage() {
  const { messages, locale } = useI18n();
  const { slug = '' } = useParams();
  const { data } = useDevelopmentCatalog();
  const product = data.products.find((item) => item.slug === slug);
  const brand = data.brands.find((item) => item.id === product?.brandId);
  const category = data.categories.find((item) => item.slug === product?.categorySlug);
  const add = useCartStore((state) => state.add);
  const inCart = useCartStore((state) =>
    product ? state.lines.some((line) => line.productId === product.id) : false,
  );
  const favorite = useFavoritesStore((state) => (product ? state.ids.includes(product.id) : false));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const compared = useCompareStore((state) => (product ? state.ids.includes(product.id) : false));
  const toggleCompare = useCompareStore((state) => state.toggle);
  const [limitNote, setLimitNote] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const [showBar, setShowBar] = useState(false);
  const gallery = product ? orderedImages(product) : [];
  const [activeImage, setActiveImage] = useState(0);
  useEffect(() => {
    setActiveImage(0);
  }, [product?.id]);
  useEffect(() => {
    const node = addRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowBar(entry ? !entry.isIntersecting : false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [product?.id]);
  usePageTitle(product?.name[locale] ?? messages.product.missingTitle);

  if (!product || !category) {
    return <StatusPage title={messages.product.missingTitle} body={messages.product.missingBody} />;
  }

  const shown = gallery[activeImage] ?? primaryImage(product);
  const moreProducts = data.products.filter((item) => item.brandId === product.brandId && item.id !== product.id);

  return (
    <Container className="py-8 pb-28">
      <nav aria-label={messages.common.breadcrumb} className="mb-4 text-sm text-muted">
        <Link to="/" className="font-semibold text-brand-blue">
          {messages.common.home}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link to={`/category/${category.slug}`} className="font-semibold text-brand-blue">
          {category.name[locale]}
        </Link>
      </nav>
      <DevNotice />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-line bg-white p-4">
          <div className="flex aspect-[4/3] items-center justify-center bg-white p-4">
            <ProductImage
              src={shown.src}
              alt={shown.alt[locale]}
              categorySlug={product.categorySlug}
              priority
            />
          </div>
          {gallery.length > 1 ? (
            <ul className="mt-3 flex gap-2">
              {gallery.map((image, index) => (
                <li key={`${image.sort}-${image.src}`}>
                  <button
                    type="button"
                    aria-pressed={index === activeImage}
                    aria-label={image.alt[locale]}
                    onClick={() => setActiveImage(index)}
                    className={`flex h-16 w-16 items-center justify-center rounded-sm border bg-white p-1 ${
                      index === activeImage ? 'border-brand-blue' : 'border-line'
                    }`}
                  >
                    <ProductImage
                      src={image.src}
                      alt=""
                      categorySlug={product.categorySlug}
                      className="h-full w-full object-contain"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            {shown.kind === 'placeholder'
              ? messages.product.placeholderNote
              : messages.product.photoNote}
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-brand-red">{messages.product.demo}</p>
          <p className="mt-3 text-sm font-semibold text-brand-blue">{brand?.name}</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">{product.name[locale]}</h1>
          <p className="mt-3 text-base leading-7 text-muted">{product.highlight[locale]}</p>
          <div className="mt-6">
            <PriceDisplay price={product.price} compareAt={product.compareAtPrice} />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">{messages.product.availability}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              ref={addRef}
              type="button"
              onClick={() => pushToast(add(product.id) === 'max' ? 'cartMax' : 'cartAdded')}
              className="inline-flex h-12 min-w-40 cursor-pointer items-center justify-center bg-brand-blue px-8 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-brand-blue-dark hover:shadow-[0_10px_20px_rgb(12_86_149/0.28)] active:translate-y-0"
            >
              {inCart ? messages.product.inCart : messages.product.add}
            </button>
            <button
              type="button"
              aria-pressed={favorite}
              onClick={() => toggleFavorite(product.id)}
              className="inline-flex h-12 cursor-pointer items-center gap-2 border border-line px-4 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:border-brand-blue hover:bg-[#f3f8fc] hover:shadow-sm active:translate-y-0"
            >
              <Heart
                className="h-5 w-5"
                aria-hidden="true"
                fill={favorite ? '#e52629' : 'none'}
                color={favorite ? '#e52629' : 'currentColor'}
              />
              {favorite ? messages.product.favoriteRemove : messages.product.favoriteAdd}
            </button>
            <button
              type="button"
              aria-pressed={compared}
              onClick={() => {
                const result = toggleCompare(product.id);
                setLimitNote(result === 'limit');
              }}
              className="inline-flex h-12 cursor-pointer items-center gap-2 border border-line px-4 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:border-brand-blue hover:bg-[#f3f8fc] hover:shadow-sm active:translate-y-0"
            >
              <Scale className="h-5 w-5" aria-hidden="true" />
              {compared ? messages.product.compareRemove : messages.product.compareAdd}
            </button>
          </div>
          {limitNote ? (
            <p role="status" className="mt-3 text-sm text-brand-red">
              {messages.product.compareLimit}
            </p>
          ) : null}
          <div className="mt-4">
            <Link
              to={`/category/${category.slug}`}
              className="text-sm font-semibold text-brand-blue"
            >
              {messages.product.backToCategory}
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-10 lg:w-1/2">
        <ProductDetails
          name={product.name[locale]}
          details={product.details ?? { spec: [], features: [], info: [] }}
        />
      </div>
      {brand && moreProducts.length > 0 ? (
        <BrandShelf
          products={moreProducts}
          title={fill(messages.product.moreFromBrand, { brand: brand.name })}
          href={`/brands/${brand.slug}`}
          actionLabel={messages.product.brandProducts}
        />
      ) : null}
      {showBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
          <Container className="flex items-center gap-3 py-2">
            <img src={shown.src} alt="" className="h-12 w-12 shrink-0 object-contain" />
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{product.name[locale]}</p>
            <PriceDisplay price={product.price} compareAt={product.compareAtPrice} compact />
            <button
              type="button"
              onClick={() => pushToast(add(product.id) === 'max' ? 'cartMax' : 'cartAdded')}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-blue px-4 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-brand-blue-dark hover:shadow-[0_10px_20px_rgb(12_86_149/0.28)] active:translate-y-0"
            >
              {inCart ? messages.product.inCart : messages.product.add}
            </button>
          </Container>
        </div>
      ) : null}
    </Container>
  );
}
