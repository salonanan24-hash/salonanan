import { formatMoney, ils } from '@anan/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { brandById, categoryBySlug, lineAmount, optionById, optionName, primaryImage, productById, productsInCategory } from '@/data/catalog';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { quoteOrder } from '@/orders/api';
import { fill, useI18n } from '@/i18n';
import { pushToast } from '@/components/ui/ActionToast';
import { Container } from '@/components/ui/Container';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { useCartStore } from '@/stores/cart-store';

export function CartPage() {
  const { locale, messages } = useI18n();
  const navigate = useNavigate();
  usePageTitle(messages.cart.title);
  useDevelopmentCatalog();
  const lines = useCartStore((state) => state.lines);
  const couponCode = useCartStore((state) => state.couponCode);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);
  const setCouponCode = useCartStore((state) => state.setCouponCode);
  const [draftCode, setDraftCode] = useState(couponCode);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [couponNote, setCouponNote] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!couponCode || lines.length === 0) {
      setDiscountMinor(0);
      return;
    }
    let active = true;
    void quoteOrder({
      lines: lines.map((line) => ({ productId: line.productId, variantId: line.variantId ?? '', quantity: line.quantity })),
      couponCode,
    })
      .then((quote) => {
        if (active) setDiscountMinor(quote.discountMinor);
      })
      .catch(() => {
        if (!active) return;
        setCouponCode('');
        setDiscountMinor(0);
      });
    return () => {
      active = false;
    };
  }, [couponCode, lines, setCouponCode]);

  const priced = lines.flatMap((line) => {
    const product = productById(line.productId);
    return product ? [{ line, product }] : [];
  });
  const subtotalMinor = priced.reduce((sum, item) => sum + lineAmount(item.product, item.line.variantId) * item.line.quantity, 0);
  const totalMinor = Math.max(0, subtotalMinor - (couponCode ? discountMinor : 0));
  const categorySlug = priced[0]?.product.categorySlug;
  const sameCategory = Boolean(categorySlug) && priced.every((item) => item.product.categorySlug === categorySlug);
  const category = sameCategory && categorySlug ? categoryBySlug(categorySlug) : undefined;
  const related = categorySlug
    ? productsInCategory(categorySlug).filter((product) => !lines.some((line) => line.productId === product.id)).slice(0, 8)
    : [];

  async function applyCoupon() {
    const code = draftCode.trim();
    if (!code || lines.length === 0) {
      setCouponCode('');
      setDiscountMinor(0);
      setCouponNote('');
      return;
    }
    setPending(true);
    setCouponNote('');
    try {
      const quote = await quoteOrder({
        lines: lines.map((line) => ({ productId: line.productId, variantId: line.variantId ?? '', quantity: line.quantity })),
        couponCode: code,
      });
      setCouponCode(quote.couponCode);
      setDiscountMinor(quote.discountMinor);
      setCouponNote(messages.cart.couponApplied);
    } catch (error) {
      setCouponCode('');
      setDiscountMinor(0);
      setCouponNote(
        error instanceof Error && error.message === 'coupon_scope'
          ? messages.cart.couponScope
          : error instanceof Error && error.message === 'coupon'
            ? messages.cart.couponMissing
            : messages.cart.couponFailed,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-extrabold text-ink">{messages.cart.title}</h1>
      {priced.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-8">
          <p className="text-ink">{messages.cart.empty}</p>
          <Link to="/" className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white">
            {messages.cart.continue}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ul className="divide-y divide-line">
            {priced.map(({ line, product }) => {
              const image = primaryImage(product);
              const brand = brandById(product.brandId);
              const option = optionById(product, line.variantId);
              const amount = lineAmount(product, line.variantId);
              return (
                <li key={`${line.productId}:${line.variantId ?? ''}`} className="flex items-center gap-4 py-5">
                  <Link to={`/product/${product.slug}`} className="shrink-0">
                    <img src={image.src} alt={image.alt[locale]} className="h-24 w-28 object-contain" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    {brand ? <p className="text-xs font-bold text-brand-blue">{brand.name}</p> : null}
                    <Link to={`/product/${product.slug}`} className="mt-1 block font-bold leading-6 text-ink hover:text-brand-blue">
                      {optionName(product.name[locale], option)}
                    </Link>
                    <p className="mt-2 text-lg font-extrabold tabular-nums text-ink">
                      {formatMoney(ils(amount * line.quantity), locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center rounded-full border border-line">
                      <button
                        type="button"
                        aria-label={messages.cart.decrease}
                        onClick={() => setQuantity(line.productId, line.quantity - 1, line.variantId)}
                        className="h-9 w-9"
                      >
                        −
                      </button>
                      <span className="inline-flex h-9 min-w-8 items-center justify-center text-sm font-bold">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={messages.cart.increase}
                        onClick={() => {
                          if (setQuantity(line.productId, line.quantity + 1, line.variantId) === 'max') pushToast('cartMax');
                        }}
                        className="h-9 w-9"
                      >
                        +
                      </button>
                    </div>
                    <Link
                      to={`/product/${product.slug}`}
                      aria-label={messages.cart.toProduct}
                      className="inline-flex size-9 items-center justify-center text-muted hover:text-ink"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <button
                      type="button"
                      aria-label={messages.cart.remove}
                      onClick={() => remove(line.productId, line.variantId)}
                      className="inline-flex size-9 items-center justify-center text-muted hover:text-brand-red"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="rounded-2xl border border-[#ececec] bg-white p-5 shadow-[0_8px_24px_rgb(23_32_51/0.04)]">
            <h2 className="text-center text-lg font-extrabold text-ink">{messages.cart.summary}</h2>
            <p className="mt-5 text-sm font-bold text-ink">{messages.cart.couponAsk}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{messages.cart.couponHint}</p>
            <div className="mt-3 flex gap-2">
              <input
                value={draftCode}
                onChange={(event) => setDraftCode(event.target.value)}
                placeholder={messages.cart.couponLabel}
                className="h-11 min-w-0 flex-1 rounded-md border border-line px-3 text-sm"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => void applyCoupon()}
                className="h-11 shrink-0 rounded-md bg-ink px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {messages.cart.apply}
              </button>
            </div>
            {couponNote ? <p className="mt-2 text-sm text-ink">{couponNote}</p> : null}
            <div className="mt-5 space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span className="font-bold tabular-nums">{formatMoney(ils(subtotalMinor), locale)}</span>
                <span className="text-muted">{messages.cart.subtotalLabel}</span>
              </p>
              {couponCode && discountMinor > 0 ? (
                <p className="flex items-center justify-between">
                  <span className="font-bold tabular-nums text-brand-red">−{formatMoney(ils(discountMinor), locale)}</span>
                  <span className="text-muted">{messages.cart.discount}</span>
                </p>
              ) : null}
              <p className="flex items-center justify-between text-base">
                <span className="font-extrabold tabular-nums">{formatMoney(ils(totalMinor), locale)}</span>
                <span className="font-bold">{messages.cart.totalDue}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#f5c518] text-sm font-extrabold text-ink"
            >
              {messages.cart.pay}
            </button>
          </aside>
        </div>
      )}
      {related.length > 0 ? (
        <div className="mt-12">
          <ProductCarousel
            products={related}
            title={
              category
                ? fill(messages.cart.alsoBought, { category: category.name[locale] })
                : messages.cart.alsoBoughtGeneric
            }
          />
        </div>
      ) : null}
    </Container>
  );
}
