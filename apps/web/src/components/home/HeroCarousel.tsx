import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { promoBanners, type PromoBanner } from '@/data/banners';
import { useI18n } from '@/i18n';

const mainSlides = promoBanners.filter((banner) => banner.placement === 'main');

const stageImages: Record<string, readonly string[]> = {
  'banner-kitchen': ['/catalog/vis-oven.webp', '/catalog/vis-cooktop.webp', '/catalog/vis-dishwasher.webp'],
  'banner-living': ['/catalog/vis-tv.webp', '/catalog/product-laptop.webp', '/catalog/vis-phone.webp'],
  'banner-fridge': ['/catalog/vis-fridge.webp', '/catalog/vis-fridge-side.webp', '/catalog/vis-washer.webp'],
};

export function HeroCarousel() {
  const { locale, messages } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = mainSlides.length;
  const slide = mainSlides[index] ?? mainSlides[0];

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  if (!slide) return null;

  function go(next: number) {
    setIndex((next + count) % count);
  }

  const images = stageImages[slide.id] ?? [slide.image];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={messages.hero.kicker}
      className="relative overflow-hidden rounded-2xl bg-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="relative grid lg:min-h-[24rem] lg:grid-cols-2"
        onTouchStart={(event) => {
          touchX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          const end = event.changedTouches[0]?.clientX;
          if (start == null || end == null) return;
          const delta = start - end;
          if (delta > 40) go(index + 1);
          else if (delta < -40) go(index - 1);
        }}
      >
        <div key={slide.id} className="anan-rise relative z-10 flex flex-col justify-center px-5 py-8 sm:px-10">
          <p className="text-xs font-bold text-brand-red">{messages.home.spot}</p>
          <p className="mt-3 text-sm font-semibold text-brand-blue">{slide.eyebrow[locale]}</p>
          <h1 className="mt-1 max-w-xl text-4xl font-black leading-tight text-ink sm:text-5xl">
            {slide.title[locale]}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted sm:text-base">{slide.body[locale]}</p>
          <BannerLink banner={slide} className="mt-6" />
          <div className="mt-6 flex items-center gap-2">
            {mainSlides.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={messages.hero.dot.replace('{index}', String(itemIndex + 1))}
                aria-current={itemIndex === index}
                onClick={() => setIndex(itemIndex)}
                className={`h-2 rounded-full ${itemIndex === index ? 'w-7 bg-brand-red' : 'w-2 bg-[#d5dde8]'}`}
              />
            ))}
          </div>
        </div>
        <div className="relative flex items-end justify-center px-4 pb-4 sm:px-8">
          <div className="relative flex items-end justify-center gap-1 sm:gap-3">
            {images.map((src, imageIndex) => (
              <img
                key={`${slide.id}-${src}`}
                src={src}
                alt={imageIndex === 0 ? slide.imageAlt[locale] : ''}
                width={800}
                height={800}
                fetchPriority={index === 0 && imageIndex === 0 ? 'high' : 'auto'}
                style={{ animationDelay: `${imageIndex * 0.35}s` }}
                className={`anan-float w-auto object-contain ${
                  imageIndex === 0 ? 'h-52 sm:h-72' : 'h-36 sm:h-48'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label={messages.hero.prev}
            onClick={() => go(index - 1)}
            className="absolute start-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-white/90 text-ink shadow-sm"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={messages.hero.next}
            onClick={() => go(index + 1)}
            className="absolute end-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-white/90 text-ink shadow-sm"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

function BannerLink({ banner, className }: { banner: PromoBanner; className?: string }) {
  const { locale } = useI18n();
  const classNames = `inline-flex h-11 items-center rounded-full bg-brand-red px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgb(229_38_41/0.28)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#c81f22] ${className ?? ''}`;

  if (banner.href.startsWith('#')) {
    return (
      <a href={banner.href} className={classNames}>
        {banner.ctaLabel[locale]}
      </a>
    );
  }

  return (
    <Link to={banner.href} className={classNames}>
      {banner.ctaLabel[locale]}
    </Link>
  );
}
