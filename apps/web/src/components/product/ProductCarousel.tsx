import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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
  perRow?: 4 | 5 | 6;
  aside?: ReactNode;
  loop?: boolean;
};

const cardWidth = {
  4: 'w-[calc((100cqw-0.75rem)/2)] md:w-[calc((100cqw-1.5rem)/3)] lg:w-[calc((100cqw-3rem)/4)] xl:w-[calc((100cqw-4rem)/4.5)] retail:w-[calc((100cqw-4rem)/4.5)]',
  5: 'w-[calc((100cqw-0.75rem)/2)] md:w-[calc((100cqw-1.5rem)/3)] lg:w-[calc((100cqw-3rem)/4)] xl:w-[calc((100cqw-4rem)/5)] retail:w-[calc((100cqw-4rem)/5)]',
  6: 'w-[calc((100cqw-0.75rem)/2)] md:w-[calc((100cqw-1.5rem)/3)] lg:w-[calc((100cqw-3rem)/4)] xl:w-[calc((100cqw-5rem)/6)] retail:w-[calc((100cqw-5rem)/6)]',
} as const;

function motion(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function alignCard(container: HTMLElement, element: HTMLElement, edge: 'start' | 'end', behavior: ScrollBehavior = motion()) {
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
  if (Math.abs(delta) < 1) return;
  container.scrollBy({ left: delta, behavior });
}

/** Move so `to` sits exactly where `from` was. Keeps free scroll offset. */
function jumpPreserve(container: HTMLElement, from: HTMLElement, to: HTMLElement) {
  const delta = from.getBoundingClientRect().left - to.getBoundingClientRect().left;
  if (Math.abs(delta) < 1) return;
  container.scrollBy({ left: delta, behavior: 'auto' });
}

function useFreeScroll() {
  const [free, setFree] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : true,
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const sync = () => setFree(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return free;
}

export function ProductCarousel({
  products,
  title,
  subtitle,
  href,
  actionLabel,
  headingId,
  perRow = 5,
  aside,
  loop = false,
}: ProductCarouselProps) {
  const { messages } = useI18n();
  // Aside (ad beside products) narrows the track on large screens; loop settle jumps
  // yank the row back to the first card after a free drag — same as small screens.
  const freeScroll = useFreeScroll() || Boolean(aside);
  const scrollerId = `product-carousel-${useId().replaceAll(':', '')}`;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const settling = useRef(false);
  const settleLock = useRef(0);
  const settleRef = useRef<() => void>(() => {});
  const touchActive = useRef(false);
  const [edges, setEdges] = useState({ prev: false, next: false, overflow: false });
  const [dragging, setDragging] = useState(false);

  // Infinite loop jumps fight free finger/mouse scrolling and yank the row back.
  const looping = loop && !freeScroll && products.length > 1;
  const signature = products.map((product) => product.id).join('|');
  const snapCards = !freeScroll && !looping;

  const measure = useCallback(() => {
    const root = scrollerRef.current;
    const items = itemRefs.current.filter((item): item is HTMLLIElement => item !== null);
    if (!root || items.length === 0) {
      setEdges((current) => (current.overflow || current.prev || current.next ? { prev: false, next: false, overflow: false } : current));
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const rtl = getComputedStyle(root).direction === 'rtl';
    const first = items[0]?.getBoundingClientRect();
    const last = items[items.length - 1]?.getBoundingClientRect();
    if (!first || !last) return;
    const overflow = root.scrollWidth - root.clientWidth > 4;
    if (!overflow) {
      setEdges((current) => (current.overflow || current.prev || current.next ? { prev: false, next: false, overflow: false } : current));
      return;
    }
    const next = {
      prev: rtl ? first.right > rootRect.right + 4 : first.left < rootRect.left - 4,
      next: rtl ? last.left < rootRect.left - 4 : last.right > rootRect.right + 4,
      overflow: true,
    };
    setEdges((current) =>
      current.prev === next.prev && current.next === next.next && current.overflow === next.overflow ? current : next,
    );
  }, []);

  useEffect(() => {
    measure();
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    let settleTimer = 0;
    const scheduleSettle = () => {
      if (!looping || settling.current || touchActive.current || dragRef.current?.moved) return;
      if (performance.now() < settleLock.current) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => settleRef.current(), 180);
    };
    const onScroll = () => {
      measure();
      scheduleSettle();
    };
    const onTouchStart = () => {
      touchActive.current = true;
      window.clearTimeout(settleTimer);
    };
    const onTouchEnd = () => {
      touchActive.current = false;
      scheduleSettle();
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('scrollend', onScroll);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd, { passive: true });
    root.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      root.removeEventListener('scroll', onScroll);
      root.removeEventListener('scrollend', onScroll);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('resize', measure);
    };
  }, [measure, signature, looping]);

  useLayoutEffect(() => {
    if (!looping) return;
    const root = scrollerRef.current;
    const from = itemRefs.current[0];
    const to = itemRefs.current[products.length];
    if (!root || !from || !to) return;
    itemRefs.current.length = products.length * 3;
    settling.current = true;
    settleLock.current = performance.now() + 400;
    root.style.scrollBehavior = 'auto';
    root.style.scrollSnapType = 'none';
    jumpPreserve(root, from, to);
    root.style.scrollBehavior = '';
    root.style.scrollSnapType = '';
    requestAnimationFrame(() => {
      settling.current = false;
      measure();
    });
  }, [looping, signature, products.length, measure]);

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

  function settleLoop() {
    const root = scrollerRef.current;
    const count = products.length;
    if (!looping || !root || count < 2 || settling.current || touchActive.current) return;
    if (performance.now() < settleLock.current) return;
    const index = firstVisibleIndex();
    const target = index < count ? index + count : index >= count * 2 ? index - count : index;
    if (target === index) return;
    const from = itemRefs.current[index];
    const to = itemRefs.current[target];
    if (!from || !to) return;
    settling.current = true;
    settleLock.current = performance.now() + 450;
    root.style.scrollBehavior = 'auto';
    root.style.scrollSnapType = 'none';
    jumpPreserve(root, from, to);
    root.style.scrollBehavior = '';
    root.style.scrollSnapType = '';
    requestAnimationFrame(() => {
      settling.current = false;
      measure();
    });
  }

  settleRef.current = settleLoop;

  function scrollByPage(direction: 1 | -1) {
    const root = scrollerRef.current;
    if (!root) return;
    settleLock.current = performance.now() + 500;

    if (freeScroll) {
      const step = Math.max(root.clientWidth * 0.8, 120);
      const rtl = getComputedStyle(root).direction === 'rtl';
      const sign = rtl ? -direction : direction;
      root.scrollBy({ left: sign * step, behavior: motion() });
      return;
    }

    const count = products.length;
    const span = looping ? count * 3 : count;
    const current = firstVisibleIndex();
    let target = current + direction;
    if (looping) {
      if (target < 0) target = span - 1;
      if (target >= span) target = 0;
    } else {
      target = Math.max(0, Math.min(count - 1, target));
    }
    const element = itemRefs.current[target];
    if (!element) return;
    alignCard(root, element, 'start');
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
      const origin = looping ? products.length : 0;
      const first = itemRefs.current[origin];
      if (first && scrollerRef.current) alignCard(scrollerRef.current, first, 'start');
    } else if (event.key === 'End') {
      event.preventDefault();
      const origin = looping ? products.length : 0;
      const last = itemRefs.current[origin + products.length - 1];
      if (last && scrollerRef.current) alignCard(scrollerRef.current, last, 'end');
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a')) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const node = event.currentTarget;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
      drag.moved = true;
      setDragging(true);
      node.setPointerCapture(event.pointerId);
      node.style.scrollBehavior = 'auto';
      node.style.scrollSnapType = 'none';
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
    node.scrollBy({ left: -dx });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const node = event.currentTarget;
    if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    node.style.scrollBehavior = '';
    node.style.scrollSnapType = '';
    setDragging(false);
    if (!drag.moved) return;
    const stopClick = (clickEvent: MouseEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      node.removeEventListener('click', stopClick, true);
    };
    node.addEventListener('click', stopClick, true);
    requestAnimationFrame(() => settleRef.current());
  }

  const showArrows = edges.overflow && (looping || edges.prev || edges.next);

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
                disabled={!looping && !edges.prev}
                onClick={() => scrollByPage(-1)}
                className="inline-flex h-9 w-9 items-center justify-center border border-line bg-white text-ink disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={messages.carousel.next}
                aria-controls={scrollerId}
                disabled={!looping && !edges.next}
                onClick={() => scrollByPage(1)}
                className="inline-flex h-9 w-9 items-center justify-center border border-line bg-white text-ink disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null
        }
      />
      <div className={aside ? 'flex flex-col-reverse gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-stretch' : undefined}>
        <div
          id={scrollerId}
          ref={scrollerRef}
          tabIndex={showArrows ? 0 : undefined}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDragStart={(event) => event.preventDefault()}
          className={`@container min-w-0 touch-manipulation overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          } ${snapCards ? 'snap-x snap-mandatory scroll-smooth' : 'snap-none'}`}
        >
          <ul className="flex w-max gap-3 lg:gap-4">
            {(looping ? [0, 1, 2] : [0]).flatMap((cycle) =>
              products.map((product, index) => {
                const position = cycle * products.length + index;
                return (
                  <li
                    key={`${cycle}-${product.id}`}
                    ref={(node) => {
                      itemRefs.current[position] = node;
                    }}
                    aria-hidden={looping && cycle !== 1 ? true : undefined}
                    className={`shrink-0 ${snapCards ? 'snap-start' : ''} ${cardWidth[perRow]}`}
                  >
                    <ProductCard product={product} />
                  </li>
                );
              }),
            )}
          </ul>
        </div>
        {aside ? <div className="min-h-0 xl:h-full">{aside}</div> : null}
      </div>
    </section>
  );
}
