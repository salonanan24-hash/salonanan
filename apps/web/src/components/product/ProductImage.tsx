import { useEffect, useState } from 'react';
import { ProductArt } from './ProductArt';

const FALLBACK = '/catalog/fallback.webp';

type ProductImageProps = {
  src: string;
  alt: string;
  categorySlug: string;
  priority?: boolean;
  className?: string;
};

export function ProductImage({
  src,
  alt,
  categorySlug,
  priority = false,
  className = 'h-full w-full object-contain',
}: ProductImageProps) {
  const [current, setCurrent] = useState(src);
  const [useArt, setUseArt] = useState(false);

  useEffect(() => {
    setCurrent(src);
    setUseArt(false);
  }, [src]);

  if (useArt) {
    return <ProductArt categorySlug={categorySlug} />;
  }

  return (
    <img
      src={current}
      alt={alt}
      width={1200}
      height={900}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => {
        if (current !== FALLBACK) setCurrent(FALLBACK);
        else setUseArt(true);
      }}
      className={className}
    />
  );
}
