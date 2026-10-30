import { CreditCard, Home, Languages, Truck } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { categoryBySlug, categoryImage, searchProducts, type DemoProduct } from '@/data/catalog';
import { fill, useI18n } from '@/i18n';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { CategoryCard } from '@/components/category/CategoryCard';
import { HomeAds } from '@/components/home/HomeAds';
import { Reveal } from '@/components/home/Reveal';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Container } from '@/components/ui/Container';
import { SectionHeader } from '@/components/ui/SectionHeader';

const departmentSlugs = ['refrigerators', 'washing-machines', 'televisions', 'air-conditioners'] as const;

export function HomePage() {
  const { messages } = useI18n();
  usePageTitle(messages.meta.homeTitle);
  const { data } = useDevelopmentCatalog();
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const results = query ? searchProducts(query) : [];
  const products = data.products;
  const inCategory = (...slugs: string[]) => products.filter((product) => slugs.includes(product.categorySlug));

  return (
    <div className="bg-white pb-8">
      <Container className="pt-3">
        {query ? (
          <div className="py-8">
            <SectionHeader
              title={fill(messages.search.results, { query })}
              subtitle={fill(messages.search.count, { count: results.length })}
            />
            <ProductGrid products={results} />
          </div>
        ) : (
          <div className="pt-3">
            <HomeAds />
          </div>
        )}
      </Container>

      {query ? null : (
        <>
          <CategoryShortcuts />
          <ProductSection
            title={messages.home.featuredTitle}
            subtitle={messages.home.featuredSubtitle}
            products={products.slice(0, 12)}
          />
          <Container className="py-2">
            <HomeAds placement="square" />
          </Container>
          <DepartmentGrid />
          <ProductSection
            id="fridges"
            title={messages.home.fridgesTitle}
            products={inCategory('refrigerators')}
            href="/category/refrigerators"
          />
          <WideStrip />
          <ProductSection
            id="laundry"
            title={messages.home.washersTitle}
            products={inCategory('washing-machines', 'dryers')}
            href="/category/washing-machines"
          />
          <DuoAds />
          <ProductSection
            id="entertainment"
            title={messages.home.tvsTitle}
            products={inCategory('televisions')}
            href="/category/televisions"
          />
          <ProductSection
            id="tech"
            title={messages.home.techTitle}
            subtitle={messages.home.featuredSubtitle}
            products={inCategory('computers', 'smartphones')}
            href="/category/computers"
          />
          <ProductSection
            id="kitchen"
            title={messages.home.adKitchenTitle}
            subtitle={messages.home.featuredSubtitle}
            products={inCategory('ovens', 'cooktops', 'dishwashers', 'small-appliances')}
            href="/category/ovens"
          />
          <BrandStrip />
          <Benefits />
        </>
      )}
    </div>
  );
}

function CategoryShortcuts() {
  const { messages } = useI18n();
  const { data } = useDevelopmentCatalog();

  return (
    <Container className="py-6">
      <div id="categories" className="scroll-mt-40">
        <RuledTitle title={messages.categories.title} />
        <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-6 xl:grid-cols-9 xl:gap-x-1">
          {data.categories.map((category, index) => (
            <li key={category.id} className="anan-rise" style={{ animationDelay: `${index * 45}ms` }}>
              <CategoryCard category={category} />
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

function BrandStrip() {
  const { messages } = useI18n();
  const { data } = useDevelopmentCatalog();
  const brands = data.brands;
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const holdingRef = useRef(false);
  const resumeRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);
  const stepFrameRef = useRef<number | null>(null);
  const kickRef = useRef<() => void>(() => {});
  const [wide, setWide] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);

  useLayoutEffect(() => {
    const wideQuery = window.matchMedia('(min-width: 1024px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setWide(wideQuery.matches);
      setReduceMotion(motionQuery.matches);
    };
    apply();
    wideQuery.addEventListener('change', apply);
    motionQuery.addEventListener('change', apply);
    return () => {
      wideQuery.removeEventListener('change', apply);
      motionQuery.removeEventListener('change', apply);
    };
  }, []);

  const slide = !wide && brands.length > 3 && !reduceMotion;

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node || !slide) return;
    const measure = () => setViewportWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [slide, brands.length]);

  const gap = 8;
  const itemWidth = viewportWidth > 0 ? (viewportWidth - gap * 2) / 3 : 0;
  const copies = slide ? [0, 1, 2] : [0];

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !slide || itemWidth <= 0) return;
    const stepWidth = itemWidth + gap;
    const group = brands.length * stepWidth;
    if (node.scrollLeft < group) node.scrollLeft = group;

    let stopped = false;

    const normalize = () => {
      if (group <= 0) return;
      while (node.scrollLeft >= group * 2) node.scrollLeft -= group;
      while (node.scrollLeft < group) node.scrollLeft += group;
    };

    const clearMotion = () => {
      if (stepTimerRef.current !== null) {
        window.clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (stepFrameRef.current !== null) {
        window.cancelAnimationFrame(stepFrameRef.current);
        stepFrameRef.current = null;
      }
    };

    const schedule = () => {
      if (stopped || pausedRef.current) return;
      clearMotion();
      stepTimerRef.current = window.setTimeout(run, 2000);
    };

    const glide = (to: number, done: () => void) => {
      const from = node.scrollLeft;
      const start = performance.now();
      const tick = (now: number) => {
        if (stopped || pausedRef.current) return;
        const t = Math.min(1, (now - start) / 650);
        const eased = 1 - (1 - t) ** 3;
        node.scrollLeft = from + (to - from) * eased;
        if (t < 1) {
          stepFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }
        stepFrameRef.current = null;
        normalize();
        done();
      };
      stepFrameRef.current = window.requestAnimationFrame(tick);
    };

    const run = () => {
      if (stopped || pausedRef.current) return;
      glide(node.scrollLeft + stepWidth, schedule);
    };

    const settle = () => {
      if (stopped || pausedRef.current) return;
      clearMotion();
      normalize();
      const aligned = group + Math.round((node.scrollLeft - group) / stepWidth) * stepWidth;
      if (Math.abs(node.scrollLeft - aligned) < 1) {
        schedule();
        return;
      }
      glide(aligned, schedule);
    };

    kickRef.current = settle;
    schedule();

    const onScroll = () => {
      if (pausedRef.current) normalize();
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      stopped = true;
      clearMotion();
      kickRef.current = () => {};
      node.removeEventListener('scroll', onScroll);
    };
  }, [slide, itemWidth, brands.length]);

  useEffect(() => {
    if (!slide) return;
    const release = () => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      if (resumeRef.current !== null) window.clearTimeout(resumeRef.current);
      resumeRef.current = window.setTimeout(() => {
        pausedRef.current = false;
        resumeRef.current = null;
        kickRef.current();
      }, 3000);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('touchend', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('touchend', release);
      if (resumeRef.current !== null) window.clearTimeout(resumeRef.current);
    };
  }, [slide]);

  function hold() {
    if (!slide) return;
    holdingRef.current = true;
    pausedRef.current = true;
    if (resumeRef.current !== null) {
      window.clearTimeout(resumeRef.current);
      resumeRef.current = null;
    }
    if (stepTimerRef.current !== null) {
      window.clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (stepFrameRef.current !== null) {
      window.cancelAnimationFrame(stepFrameRef.current);
      stepFrameRef.current = null;
    }
  }

  return (
    <Container className="py-6">
      <div id="brands" className="scroll-mt-40">
        <RuledTitle title={messages.brands.title} />
        <div
          ref={viewportRef}
          dir={slide ? 'ltr' : undefined}
          onPointerDown={hold}
          className={
            slide
              ? 'overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : wide
                ? 'overflow-x-auto'
                : 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          }
        >
          <ul
            className={
              slide
                ? 'flex w-max flex-nowrap'
                : wide
                  ? 'flex w-max min-w-full items-stretch justify-center gap-3'
                  : 'grid w-full auto-cols-[calc((100%-1rem)/3)] grid-flow-col gap-2'
            }
          >
            {copies.map((copy) => (
              <li key={copy} className={slide ? 'flex shrink-0' : 'contents'} aria-hidden={copy > 0 ? true : undefined}>
                {brands.map((brand) => (
                  <div
                    key={brand.slug}
                    className={slide ? 'shrink-0' : wide ? 'shrink-0' : 'min-w-0'}
                    style={slide && itemWidth > 0 ? { width: itemWidth, marginRight: gap } : undefined}
                  >
                    <Link
                      to={`/brands/${brand.slug}`}
                      tabIndex={copy > 0 ? -1 : undefined}
                      className="flex h-16 w-full items-center justify-center px-2 lg:h-[4.5rem] lg:min-w-36 lg:px-5"
                    >
                      {brand.image ? (
                        <img src={brand.image} alt={brand.name} className="h-9 w-full object-contain lg:h-10 lg:max-w-32" />
                      ) : (
                        <span className="truncate text-sm font-black tracking-tight text-ink lg:text-lg">{brand.name}</span>
                      )}
                    </Link>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
        <p className="mx-auto mt-3 max-w-3xl text-center text-xs leading-5 text-muted">
          {messages.brands.subtitle}
        </p>
      </div>
    </Container>
  );
}

function ProductSection({
  id,
  title,
  subtitle,
  products,
  href,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  products: readonly DemoProduct[];
  href?: string;
}) {
  const { messages } = useI18n();
  if (products.length === 0) return null;

  return (
    <Container className="py-4">
      <Reveal>
      <div id={id} className="scroll-mt-40">
        <ProductCarousel
          products={products}
          title={title}
          subtitle={subtitle}
          href={href}
          actionLabel={href ? messages.home.viewCategory : undefined}
          perRow={6}
        />
      </div>
      </Reveal>
    </Container>
  );
}

function Benefits() {
  const { messages } = useI18n();
  const items = [
    { icon: Truck, title: messages.benefits.deliveryTitle, body: messages.benefits.deliveryBody },
    { icon: Home, title: messages.benefits.rangeTitle, body: messages.benefits.rangeBody },
    { icon: Languages, title: messages.benefits.languagesTitle, body: messages.benefits.languagesBody },
    { icon: CreditCard, title: messages.benefits.pricingTitle, body: messages.benefits.pricingBody },
  ];

  return (
    <Container className="pb-2">
      <Reveal>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="flex flex-col rounded-2xl border border-line bg-white p-4 sm:p-5"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4f7fb] text-brand-red">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-3 block text-sm font-extrabold text-ink">{item.title}</span>
            <span className="mt-1.5 block text-xs leading-5 text-muted sm:text-sm sm:leading-6">{item.body}</span>
          </li>
        ))}
      </ul>
      </Reveal>
    </Container>
  );
}

function DepartmentGrid() {
  const { locale, messages } = useI18n();

  return (
    <Container className="py-6">
      <Reveal>
        <RuledTitle title={messages.home.departmentsTitle} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {departmentSlugs.map((slug) => {
            const category = categoryBySlug(slug);
            if (!category) return null;
            return (
              <li key={slug}>
                <Link
                  to={`/category/${slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <span className="flex h-44 items-center justify-center bg-white">
                    <img
                      src={categoryImage(slug)}
                      alt=""
                      className="h-36 w-auto object-contain transition duration-500 group-hover:scale-105"
                    />
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className="text-lg font-extrabold text-ink">{category.name[locale]}</span>
                    <span className="mt-1 text-sm leading-6 text-muted">{category.description[locale]}</span>
                    <span className="mt-3 text-sm font-bold text-brand-blue">{messages.home.viewCategory}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </Container>
  );
}

function WideStrip() {
  const { messages } = useI18n();

  return (
    <section className="my-2 bg-[#141c27] text-white">
      <Container className="grid items-center gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_18rem_auto]">
        <div>
          <p className="text-xs font-bold text-white/70">{messages.home.spot}</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">{messages.home.adScreenTitle}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">{messages.home.adScreenBody}</p>
        </div>
        <img src="/catalog/vis-tv.webp" alt="" className="anan-float mx-auto h-40 w-auto object-contain" />
        <Link
          to="/category/televisions"
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-bold text-white"
        >
          {messages.home.viewCategory}
        </Link>
      </Container>
    </section>
  );
}

function AdPanel({
  href,
  kicker,
  title,
  body,
  cta,
  images,
  tone,
  compact = false,
}: {
  href: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  images: readonly string[];
  tone: 'dark' | 'blue' | 'warm';
  compact?: boolean;
}) {
  const surface =
    tone === 'dark'
      ? 'bg-[#141c27] text-white'
      : tone === 'blue'
        ? 'bg-brand-blue text-white'
        : 'bg-white text-ink';
  const muted = tone === 'warm' ? 'text-muted' : 'text-white/80';
  const kickerColor = tone === 'warm' ? 'text-brand-red' : 'text-white/80';

  return (
    <Link
      to={href}
      className={`anan-ad group relative grid overflow-hidden rounded-2xl shadow-[0_16px_40px_rgb(23_32_51/0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgb(23_32_51/0.14)] sm:flex ${surface} ${compact ? 'sm:min-h-44' : 'sm:min-h-72'}`}
    >
      <span className="anan-sheen pointer-events-none absolute inset-y-0 start-0 z-20 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <span className="relative z-10 flex max-w-none flex-col justify-center p-5 sm:max-w-xs sm:p-7">
        <span className={`text-[11px] font-bold ${kickerColor}`}>{kicker}</span>
        <span className={`mt-2 font-black leading-tight ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
          {title}
        </span>
        <span className={`mt-2 text-sm leading-6 ${muted}`}>{body}</span>
        <span
          className={`mt-4 inline-flex h-9 w-fit items-center rounded-full px-4 text-xs font-bold ${
            tone === 'warm' ? 'bg-brand-red text-white' : 'bg-white text-ink'
          }`}
        >
          {cta}
        </span>
      </span>
      <span className="pointer-events-none flex items-end justify-center gap-1 px-3 pb-3 sm:absolute sm:inset-y-0 sm:end-0 sm:justify-end sm:pe-3">
        {images.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`anan-float w-auto object-contain drop-shadow-[0_16px_20px_rgb(0_0_0/0.18)] transition duration-500 group-hover:scale-105 ${
              compact ? 'h-32 sm:h-36' : 'h-48 sm:h-64'
            }`}
          />
        ))}
      </span>
    </Link>
  );
}

function DuoAds() {
  const { locale, messages } = useI18n();
  const cards = [
    { slug: 'air-conditioners', image: '/catalog/vis-ac.webp', tone: 'blue' as const },
    { slug: 'smartphones', image: '/catalog/vis-phone.webp', tone: 'warm' as const },
  ];

  return (
    <Container className="py-4">
      <Reveal>
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => {
            const category = categoryBySlug(card.slug);
            if (!category) return null;
            return (
              <AdPanel
                key={card.slug}
                href={`/category/${card.slug}`}
                kicker={messages.home.spot}
                title={category.name[locale]}
                body={category.description[locale]}
                cta={messages.home.viewCategory}
                images={[card.image]}
                tone={card.tone}
                compact
              />
            );
          })}
        </div>
      </Reveal>
    </Container>
  );
}

function RuledTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <h2 className="shrink-0 text-sm font-bold text-ink">{title}</h2>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
