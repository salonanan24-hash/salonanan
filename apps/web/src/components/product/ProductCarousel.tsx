import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { DemoProduct } from '@/data/catalog';
import { useI18n } from '@/i18n';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ProductCard } from './ProductCard';

type ProductCarouselProps = {
  products: readonly DemoProduct[];
  title: string;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
  headingId?: string;
};

const cardWidth =
  'w-[calc((100cqw-0.75rem)/2)] md:w-[calc((100cqw-1.5rem)/3)] lg:w-[calc((100cqw-3rem)/4)] xl:w-[calc((100cqw-4rem)/5)] retail:w-[calc((100cqw-4rem)/5)]';

function visibleCount(): number {
  if (window.matchMedia('(min-width: 1440px)').matches) return 5;
  if (window.matchMedia('(min-width: 1280px)').matches) return 5;
  if (window.matchMedia('(min-width: 1024px)').matches) return 4;
  if (window.matchMedia('(min-width: 768px)').matches) return 3;
  return 2;
}

function motion(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function alignCard(container: HTMLElement, element: HTMLElement, edge: 'start' | 'end') {
  const rtl = getComputedStyle(container).direction === 'rtl';
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const delta =
    edge === 'start'
      ? rtl
        ? elementRect.right - containerRect.right
        : elementRect.left - containerRect.left
      : rtl
        ? elementRect.left - containerRect.left
        : elementRect.right - containerRect.right;
  container.scrollBy({ left: delta, behavior: motion() });
}

export function ProductCarousel({
  products,
  title,
  subtitle,
  href,
  actionLabel,
  headingId,
}: ProductCarouselProps) {
  const { messages } = useI18n();
  const scrollerId = `product-carousel-${useId().replaceAll(':', '')}`;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [edges, setEdges] = useState({ prev: false, next: false });

  const measure = useCallback(() => {
    const root = scrollerRef.current;
    const items = itemRefs.current.filter((item): item is HTMLLIElement => item !== null);
    if (!root || items.length === 0) {
      setEdges({ prev: false, next: false });
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const rtl = getComputedStyle(root).direction === 'rtl';
    const first = items[0]?.getBoundingClientRect();
    const last = items[items.length - 1]?.getBoundingClientRect();
    if (!first || !last) return;
    const overflow = root.scrollWidth - root.clientWidth > 4;
    if (!overflow) {
      setEdges({ prev: false, next: false });
      return;
    }
    setEdges({
      prev: rtl ? first.right > rootRect.right + 4 : first.left < rootRect.left - 4,
      next: rtl ? last.left < rootRect.left - 4 : last.right > rootRect.right + 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure, products]);

  if (products.length === 0) return null;

  function firstVisibleIndex() {
    const root = scrollerRef.current;
    const items = itemRefs.current;
    if (!root) return 0;
    const rootRect = root.getBoundingClientRect();
    const rtl = getComputedStyle(root).direction === 'rtl';
    let index = 0;
    let best = Number.POSITIVE_INFINITY;
    items.forEach((item, itemIndex) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const delta = rtl ? rootRect.right - rect.right : rect.left - rootRect.left;
      const score = Math.abs(delta);
      if (score < best) {
        best = score;
        index = itemIndex;
      }
    });
    return index;
  }

  function scrollByPage(direction: 1 | -1) {
    const root = scrollerRef.current;
    if (!root) return;
    const page = visibleCount();
    const current = firstVisibleIndex();
    const target = Math.max(0, Math.min(products.length - 1, current + direction * page));
    const element = itemRefs.current[target];
    if (!element) return;
    const remaining = products.length - target;
    const edge = direction > 0 && remaining < page ? 'end' : 'start';
    alignCard(root, element, edge);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByPage(rtl ? 1 : -1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByPage(rtl ? -1 : 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = itemRefs.current[0];
      if (first && scrollerRef.current) alignCard(scrollerRef.current, first, 'start');
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = itemRefs.current[products.length - 1];
      if (last && scrollerRef.current) alignCard(scrollerRef.current, last, 'end');
    }
  }

  const showArrows = edges.prev || edges.next;

  return (
    <section aria-roledescription="carousel" aria-label={title} className="min-w-0">
      <SectionHeader
        id={headingId}
        title={title}
        subtitle={subtitle}
        href={href}
        actionLabel={actionLabel}
        actions={
          showArrows ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={messages.carousel.prev}
                aria-controls={scrollerId}
                disabled={!edges.prev}
                onClick={() => scrollByPage(-1)}
                className="inline-flex h-9 w-9 items-center justify-center border border-line bg-white text-ink disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={messages.carousel.next}
                aria-controls={scrollerId}
                disabled={!edges.next}
                onClick={() => scrollByPage(1)}
                className="inline-flex h-9 w-9 items-center justify-center border border-line bg-white text-ink disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null
        }
      />
      <div
        id={scrollerId}
        ref={scrollerRef}
        tabIndex={showArrows ? 0 : undefined}
        onKeyDown={onKeyDown}
        className="@container snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex w-max gap-3 lg:gap-4">
          {products.map((product, index) => (
            <li
              key={product.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              className={`shrink-0 snap-start ${cardWidth}`}
            >
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
