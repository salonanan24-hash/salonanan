import { Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatMoney, ils } from '@anan/shared';
import { brandById, primaryImage, productById } from '@/data/catalog';
import { fill, useI18n } from '@/i18n';
import { pushToast } from '@/components/ui/ActionToast';
import { cartCount, useCartStore } from '@/stores/cart-store';

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { locale, messages } = useI18n();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [present, setPresent] = useState(open);
  const [shown, setShown] = useState(false);
  const location = useLocation();
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);
  const count = cartCount(lines);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setShown(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setShown(false);
    const timer = window.setTimeout(() => setPresent(false), 700);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!shown) return;
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [shown, onClose]);

  if (!present) return null;

  const subtotalMinor = lines.reduce((sum, line) => {
    const product = productById(line.productId);
    if (!product) return sum;
    return sum + product.price.amountMinor * line.quantity;
  }, 0);

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label={messages.cart.close}
        className={`anan-backdrop absolute inset-0 bg-[#172033] ${shown ? 'is-open' : ''}`}
        onClick={onClose}
      />
      <div
        id="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`anan-drawer absolute inset-y-0 end-0 flex w-[min(100%,26rem)] flex-col bg-white shadow-[0_0_40px_rgb(23_32_51/0.2)] ${shown ? 'is-open' : ''}`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <h2 id={titleId} className="text-xl font-extrabold text-ink">
            {fill(messages.cart.drawerTitle, { count })}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={messages.cart.close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-[#f4f7fb]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="font-bold text-ink">{messages.cart.empty}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 inline-flex h-11 items-center rounded-full bg-brand-blue px-5 text-sm font-bold text-white"
            >
              {messages.cart.keepShopping}
            </button>
          </div>
        ) : (
          <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {lines.map((line) => {
              const product = productById(line.productId);
              if (!product) {
                return (
                  <li key={line.productId} className="border-b border-line pb-4">
                    <p className="text-sm text-muted">{messages.product.missingTitle}</p>
                    <button
                      type="button"
                      onClick={() => remove(line.productId)}
                      className="mt-2 text-sm font-semibold text-brand-red"
                    >
                      {messages.cart.remove}
                    </button>
                  </li>
                );
              }

              const image = primaryImage(product);
              const brand = brandById(product.brandId);
              const lineMinor = product.price.amountMinor * line.quantity;
              const compareMinor = product.compareAtPrice
                ? product.compareAtPrice.amountMinor * line.quantity
                : null;

              return (
                <li key={line.productId} className="border-b border-line pb-4">
                  <div className="flex items-start gap-3">
                    <Link to={`/product/${product.slug}`} onClick={onClose} className="shrink-0">
                      <img
                        src={image.src}
                        alt={image.alt[locale]}
                        className="h-20 w-20 rounded-lg border border-line object-contain"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      {brand ? <p className="text-xs font-bold text-brand-blue">{brand.name}</p> : null}
                      <Link
                        to={`/product/${product.slug}`}
                        onClick={onClose}
                        className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-ink hover:text-brand-blue"
                      >
                        {product.name[locale]}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.productId)}
                      aria-label={messages.cart.remove}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[#fff4f4] hover:text-brand-red"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      {compareMinor && compareMinor > lineMinor ? (
                        <p className="text-xs text-muted line-through tabular-nums">
                          {formatMoney(ils(compareMinor), locale)}
                        </p>
                      ) : null}
                      <p className="text-lg font-extrabold tabular-nums text-ink">
                        {formatMoney(ils(lineMinor), locale)}
                      </p>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-line">
                      <button
                        type="button"
                        aria-label={messages.cart.decrease}
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        className="h-9 w-9 text-lg"
                      >
                        −
                      </button>
                      <span className="inline-flex h-9 min-w-8 items-center justify-center text-sm font-bold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={messages.cart.increase}
                        onClick={() => {
                          if (setQuantity(line.productId, line.quantity + 1) === 'max') pushToast('cartMax');
                        }}
                        className="h-9 w-9 text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 ? (
          <div className="border-t-2 border-brand-red px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">{messages.cart.subtotal}</p>
              <p className="text-xl font-extrabold tabular-nums text-ink">
                {formatMoney(ils(subtotalMinor), locale)}
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">{messages.cart.serverNote}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-line text-sm font-bold text-ink hover:border-brand-blue"
              >
                {messages.cart.keepShopping}
              </button>
              <Link
                to={location.pathname === '/cart' ? '/checkout' : '/cart'}
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white hover:bg-[#c81f22]"
              >
                {location.pathname === '/cart' ? messages.cart.pay : messages.nav.checkout}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
