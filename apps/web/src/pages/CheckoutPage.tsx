import { formatMoney, ils } from '@anan/shared';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { Breadcrumbs } from '@/components/nav/Breadcrumbs';
import { Container } from '@/components/ui/Container';
import { lineAmount, optionById, optionName, productById } from '@/data/catalog';
import { usePageTitle } from '@/hooks/use-page-title';
import { fill, useI18n } from '@/i18n';
import { placeOrder, quoteOrder, shippingZones, type ApiOrder, type ShippingZone } from '@/orders/api';
import { useCartStore } from '@/stores/cart-store';

function metaText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const fieldClass = 'h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none read-only:bg-[#f7f8fa]';

export function CheckoutPage() {
  const { locale, messages } = useI18n();
  const navigate = useNavigate();
  const auth = useAuth();
  const copy = messages.checkout;
  const lines = useCartStore((state) => state.lines);
  const couponCode = useCartStore((state) => state.couponCode);
  const clear = useCartStore((state) => state.clear);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<'pickup' | 'home'>('pickup');
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [apartment, setApartment] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [adult, setAdult] = useState(false);
  const [discountMinor, setDiscountMinor] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<ApiOrder | null>(null);
  usePageTitle(copy.title);

  useEffect(() => {
    if (!auth.user) return;
    const nextName =
      `${metaText(auth.user.user_metadata?.first_name)} ${metaText(auth.user.user_metadata?.last_name)}`.trim() ||
      metaText(auth.user.user_metadata?.full_name);
    if (nextName) setName(nextName);
    if (auth.user.email) setEmail(auth.user.email);
    const nextPhone = metaText(auth.user.user_metadata?.phone);
    if (nextPhone) setPhone(nextPhone);
  }, [auth.user]);

  useEffect(() => {
    let active = true;
    shippingZones()
      .then((result) => {
        if (!active) return;
        setZones(result.zones);
        if (result.zones.length === 0) setMethod('pickup');
      })
      .catch(() => {
        if (active) setMethod('pickup');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!couponCode || lines.length === 0) {
      setDiscountMinor(0);
      return;
    }
    let active = true;
    quoteOrder({
      lines: lines.map((line) => ({ productId: line.productId, variantId: line.variantId ?? '', quantity: line.quantity })),
      couponCode,
    })
      .then((quote) => {
        if (active) setDiscountMinor(quote.discountMinor);
      })
      .catch(() => {
        if (active) setDiscountMinor(0);
      });
    return () => {
      active = false;
    };
  }, [couponCode, lines]);

  const priced = lines.flatMap((line) => {
    const product = productById(line.productId);
    return product ? [{ line, product }] : [];
  });
  const subtotalMinor = priced.reduce((sum, item) => sum + lineAmount(item.product, item.line.variantId) * item.line.quantity, 0);
  const zone = zones.find((item) => item.id === zoneId);
  const deliveryMinor = method === 'home' ? (zone?.priceMinor ?? 0) : 0;
  const totalMinor = Math.max(0, subtotalMinor - discountMinor + deliveryMinor);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adult) return;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError(copy.missing);
      return;
    }
    if (method === 'home') {
      if (!zoneId) {
        setError(copy.zoneMissing);
        return;
      }
      if (!city.trim() || !street.trim() || !house.trim()) {
        setError(copy.addressMissing);
        return;
      }
    }
    setPending(true);
    setError('');
    try {
      const result = await placeOrder({
        lines: priced.map((item) => ({ productId: item.product.id, variantId: item.line.variantId ?? '', quantity: item.line.quantity })),
        couponCode,
        note: addressNote.trim(),
        locale,
        customer: { name: name.trim(), email: email.trim(), phone: phone.trim() },
        delivery: {
          method,
          zoneId,
          city: city.trim(),
          street: street.trim(),
          house: house.trim(),
          apartment: apartment.trim(),
        },
      });
      setOrder(result.order);
      clear();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      setError(
        code === 'stock'
          ? copy.stock
          : code === 'address'
            ? copy.addressMissing
            : code === 'zone'
              ? copy.zoneMissing
              : code === 'coupon_scope'
                ? messages.cart.couponScope
                : code === 'coupon'
                  ? messages.cart.couponMissing
                  : copy.failed,
      );
    } finally {
      setPending(false);
    }
  }

  const signedIn = Boolean(auth.user);
  const canHome = zones.length > 0;
  const shippingLabel =
    method === 'pickup' ? copy.freeShipping : zone ? formatMoney(ils(zone.priceMinor), locale) : copy.zonePlaceholder;

  if (order) {
    return (
      <Container className="py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 text-center">
          <h1 className="text-3xl font-extrabold text-ink">{copy.doneTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{fill(copy.doneBody, { number: order.number })}</p>
          <p className="mt-4 text-2xl font-extrabold tabular-nums text-ink">{formatMoney(ils(order.totalMinor), locale)}</p>
          {auth.user ? (
            <Link to={`/account/orders/${order.id}`} className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white">
              {copy.view}
            </Link>
          ) : (
            <Link to="/login" className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white">
              {messages.auth.loginTitle}
            </Link>
          )}
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <Breadcrumbs
        items={[
          { label: messages.common.home, to: '/' },
          { label: messages.cart.title, to: '/cart' },
          { label: copy.title },
        ]}
      />
      <h1 className="mt-6 text-3xl font-extrabold text-ink">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.body}</p>

      {priced.length === 0 ? (
        <div className="mt-8">
          <p className="text-ink">{messages.cart.empty}</p>
          <Link to="/cart" className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-blue px-5 text-sm font-bold text-white">
            {copy.back}
          </Link>
        </div>
      ) : (
        <form className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={onSubmit}>
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-extrabold text-ink">{copy.customer}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block font-bold text-ink">{copy.name}</span>
                  <input value={name} readOnly={signedIn && Boolean(name)} onChange={(event) => setName(event.target.value)} className={fieldClass} required />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block font-bold text-ink">{copy.email}</span>
                  <input type="email" value={email} readOnly={signedIn && Boolean(email)} onChange={(event) => setEmail(event.target.value)} className={fieldClass} required />
                </label>
              </div>
              <label className="mt-4 block text-sm">
                <span className="mb-2 block font-bold text-ink">{copy.phone}</span>
                <input value={phone} readOnly={signedIn && Boolean(phone)} onChange={(event) => setPhone(event.target.value)} className={fieldClass} required />
              </label>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-ink">{copy.shippingMethod}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMethod('pickup')}
                  className={`rounded-md border bg-white px-4 py-4 text-start text-ink ${method === 'pickup' ? 'border-2 border-brand-blue' : 'border-line'}`}
                >
                  <span className="block font-bold">{copy.pickup}</span>
                  <span className="mt-1 block text-xs text-muted">{copy.pickupHint}</span>
                </button>
                <button
                  type="button"
                  disabled={!canHome}
                  onClick={() => setMethod('home')}
                  className={`rounded-md border bg-white px-4 py-4 text-start text-ink disabled:cursor-not-allowed disabled:opacity-50 ${method === 'home' ? 'border-2 border-brand-blue' : 'border-line'}`}
                >
                  <span className="block font-bold">{copy.home}</span>
                  <span className="mt-1 block text-xs text-muted">{canHome ? copy.homeHint : copy.homeUnavailable}</span>
                </button>
              </div>
            </section>

            {method === 'home' && canHome ? (
              <section>
                <h2 className="text-lg font-extrabold text-ink">{copy.address}</h2>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm">
                    <span className="mb-2 block font-bold text-ink">{copy.zone}</span>
                    <span className="relative block">
                      <select
                        value={zoneId}
                        onChange={(event) => setZoneId(event.target.value)}
                        required
                        className={`h-12 w-full appearance-none rounded-md border border-line bg-white ps-3 pe-10 text-sm outline-none ${zoneId ? 'text-ink' : 'text-muted'}`}
                      >
                        <option value="">{copy.zonePlaceholder}</option>
                        {zones.map((item) => (
                          <option key={item.id} value={item.id}>
                            {locale === 'ar' ? item.nameAr : item.nameHe} — {formatMoney(ils(item.priceMinor), locale)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink" aria-hidden="true" />
                    </span>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-bold text-ink">{copy.city}</span>
                    <input value={city} onChange={(event) => setCity(event.target.value)} className={fieldClass} required />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-2 block font-bold text-ink">{copy.street}</span>
                    <input value={street} onChange={(event) => setStreet(event.target.value)} className={fieldClass} required />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-2 block font-bold text-ink">{copy.house}</span>
                      <input value={house} onChange={(event) => setHouse(event.target.value)} className={fieldClass} required />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-bold text-ink">{copy.apartment}</span>
                      <input value={apartment} onChange={(event) => setApartment(event.target.value)} className={fieldClass} />
                    </label>
                  </div>
                  <label className="block text-sm">
                    <span className="mb-2 block font-bold text-ink">{copy.addressNote}</span>
                    <textarea
                      value={addressNote}
                      onChange={(event) => setAddressNote(event.target.value)}
                      placeholder={copy.addressNotePlaceholder}
                      className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none"
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <div className="flex items-start gap-4 rounded-md border border-line bg-white px-4 py-4">
              <p className="min-w-0 flex-1 text-[13px] leading-6 text-ink">
                {copy.consentBeforeTerms}{' '}
                <Link to="/terms" className="font-semibold text-brand-blue underline">
                  {copy.termsLink}
                </Link>
                {copy.consentBeforePrivacy}{' '}
                <Link to="/privacy" className="font-semibold text-brand-blue underline">
                  {copy.privacyLink}
                </Link>
                {copy.consentBeforeContact}
                <Link to="/contact" className="font-semibold text-brand-blue underline">
                  {copy.contactLink}
                </Link>
                {copy.consentAfter}
              </p>
              <input
                type="checkbox"
                checked={adult}
                onChange={(event) => setAdult(event.target.checked)}
                aria-label={copy.age}
                className="mt-1 size-4 shrink-0 accent-brand-blue"
              />
            </div>
            {error ? <p className="text-sm font-semibold text-brand-red">{error}</p> : null}
          </div>

          <aside className="rounded-2xl border border-[#ececec] bg-white p-5 shadow-[0_8px_24px_rgb(23_32_51/0.04)]">
            <h2 className="text-center text-lg font-extrabold text-ink">{messages.cart.summary}</h2>
            <ul className="mt-5 space-y-3 border-b border-line pb-4">
              {priced.map(({ line, product }) => (
                <li key={`${product.id}:${line.variantId ?? ''}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 font-bold tabular-nums">
                    {formatMoney(ils(lineAmount(product, line.variantId) * line.quantity), locale)}
                  </span>
                  <span className="text-end">
                    {optionName(product.name[locale], optionById(product, line.variantId))} × {line.quantity}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-2 text-sm">
              <p className="flex items-center justify-between">
                <span className="font-bold tabular-nums">{formatMoney(ils(subtotalMinor), locale)}</span>
                <span className="text-muted">{copy.subtotal}</span>
              </p>
              {discountMinor > 0 ? (
                <p className="flex items-center justify-between">
                  <span className="font-bold tabular-nums text-brand-red">−{formatMoney(ils(discountMinor), locale)}</span>
                  <span className="text-muted">{messages.cart.discount}</span>
                </p>
              ) : null}
              <p className="flex items-center justify-between">
                <span className="font-bold tabular-nums">{shippingLabel}</span>
                <span className="text-muted">{copy.shipping}</span>
              </p>
              <p className="flex items-center justify-between text-base">
                <span className="font-extrabold tabular-nums">{formatMoney(ils(totalMinor), locale)}</span>
                <span className="font-bold">{copy.total}</span>
              </p>
            </div>
            <button
              type="submit"
              disabled={!adult || pending || (method === 'home' && !zone)}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#f5c518] text-sm font-extrabold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? copy.placing : copy.place}
            </button>
            {!adult ? <p className="mt-2 text-center text-xs text-muted">{copy.ageHint}</p> : null}
            <button type="button" onClick={() => navigate('/cart')} className="mt-3 block w-full text-center text-sm text-ink underline">
              {copy.back}
            </button>
          </aside>
        </form>
      )}
    </Container>
  );
}
