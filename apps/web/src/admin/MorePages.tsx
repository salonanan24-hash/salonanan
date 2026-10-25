import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { adminAccents, resolveAccent, type AccentId } from '@/admin/accent';
import { nid, useAdminStore } from '@/admin/store';
import type { CouponKind, ShippingZone } from '@/admin/types';
import { Field, GhostButton, IconButton, PageHeader, Panel, PrimaryButton, SelectInput, Split, TextInput } from '@/admin/ui';
import { fill, useI18n } from '@/i18n';

export function CouponsPage() {
  const { messages } = useI18n();
  const copy = messages.desk.coupons;
  const coupons = useAdminStore((state) => state.coupons);
  const saveCoupon = useAdminStore((state) => state.saveCoupon);
  const removeCoupon = useAdminStore((state) => state.removeCoupon);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<CouponKind>('percent');
  const [value, setValue] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(value);
    if (!code.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(copy.invalid);
      return;
    }
    if (kind === 'percent' && amount > 100) {
      setError(copy.invalid);
      return;
    }
    saveCoupon({
      id: nid('coupon'),
      code: code.trim().toUpperCase(),
      kind,
      value: kind === 'fixed' ? Math.round(amount * 100) : Math.round(amount),
      endsAt,
    })
      .then(() => {
        setCode('');
        setValue('');
        setEndsAt('');
        setError('');
      })
      .catch(() => setError(messages.desk.saveFailed));
  }

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.note} />
      <Split
        list={
          <Panel className="divide-y divide-line p-0">
            {coupons.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">{copy.empty}</p> : null}
            {coupons.map((coupon) => (
              <div key={coupon.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{coupon.code}</p>
                  <p className="text-xs text-muted">
                    {coupon.kind === 'percent' ? `${coupon.value}%` : `₪${coupon.value / 100}`}
                    {coupon.endsAt ? ` · ${coupon.endsAt}` : ''}
                  </p>
                </div>
                <IconButton type="button" aria-label={copy.remove} onClick={() => void removeCoupon(coupon.id)}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </IconButton>
              </div>
            ))}
          </Panel>
        }
        form={
          <Panel>
            <form className="space-y-3" onSubmit={onSubmit}>
              <h2 className="text-lg font-extrabold">{copy.add}</h2>
              <Field label={copy.code}>
                <TextInput value={code} onChange={(event) => setCode(event.target.value)} />
              </Field>
              <Field label={copy.kind}>
                <SelectInput value={kind} onChange={(event) => setKind(event.target.value as CouponKind)}>
                  <option value="percent">{copy.percent}</option>
                  <option value="fixed">{copy.fixed}</option>
                </SelectInput>
              </Field>
              <Field label={copy.value}>
                <TextInput inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
              </Field>
              <Field label={copy.ends} hint={copy.optional}>
                <TextInput type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
              </Field>
              {error ? <p className="text-sm font-semibold anan-accent-text">{error}</p> : null}
              <PrimaryButton type="submit" className="w-full">
                {copy.save}
              </PrimaryButton>
            </form>
          </Panel>
        }
      />
    </div>
  );
}

export function SettingsPage() {
  const { locale, setLocale, messages } = useI18n();
  const copy = messages.desk.settings;
  const settings = useAdminStore((state) => state.settings);
  const saveSettings = useAdminStore((state) => state.saveSettings);
  const [phone, setPhone] = useState(settings.phone);
  const [zones, setZones] = useState<ShippingZone[]>(settings.zones);
  const [picked, setPicked] = useState<AccentId>(resolveAccent(settings.accent).id);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [nameHe, setNameHe] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [price, setPrice] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [active, setActive] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setPhone(settings.phone);
    setZones(settings.zones);
    setPicked(resolveAccent(settings.accent).id);
  }, [settings]);

  function commitZones(next: ShippingZone[]) {
    setZones(next);
    saveSettings({ phone, zones: next }).catch(() => undefined);
  }

  useEffect(() => {
    if (!zoneOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setZoneOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoneOpen]);

  function openZone() {
    const next = zones.reduce((max, zone) => Math.max(max, zone.sortOrder), 0) + 1;
    setNameHe('');
    setNameAr('');
    setPrice('');
    setSortOrder(String(next));
    setActive(true);
    setInvalid(false);
    setZoneOpen(true);
  }

  function saveZone(event: FormEvent) {
    event.preventDefault();
    const shekels = Number(price);
    const order = Number(sortOrder);
    if (!nameHe.trim() || !Number.isFinite(shekels) || shekels < 0 || !Number.isInteger(order) || order < 0) {
      setInvalid(true);
      return;
    }
    const next = [
      ...zones,
      {
        id: nid('zone'),
        nameHe: nameHe.trim(),
        nameAr: nameAr.trim(),
        priceMinor: Math.round(shekels * 100),
        active,
        sortOrder: order,
      },
    ].sort((left, right) => left.sortOrder - right.sortOrder || left.nameHe.localeCompare(right.nameHe, 'he'));
    commitZones(next);
    setZoneOpen(false);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={copy.title} />
      <Panel>
        <h2 className="text-lg font-extrabold">{copy.accentsTitle}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{copy.accentsHint}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {adminAccents.map((item) => {
            const selected = picked === item.id;
            const label = copy.accents[item.id];
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setPicked(item.id);
                  saveSettings({ accent: item.id }).catch(() => undefined);
                }}
                className="flex h-14 items-center justify-start gap-3 rounded-full border bg-white px-5 text-sm font-semibold text-ink"
                style={
                  selected
                    ? { borderColor: item.hex, background: `color-mix(in srgb, ${item.hex} 8%, white)` }
                    : { borderColor: '#e5e7eb' }
                }
              >
                <span>{label}</span>
                <span className="size-5 shrink-0 rounded-full" style={{ background: item.hex }} />
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-sm text-muted">{fill(copy.accentChosen, { name: copy.accents[picked] })}</span>
          <button
            type="button"
            className="h-10 rounded-xl px-4 text-sm font-bold text-white"
            style={{ background: resolveAccent(picked).hex }}
            onClick={() => void saveSettings({ accent: picked }).catch(() => undefined)}
          >
            {copy.accentPreview}
          </button>
        </div>
      </Panel>
      <Panel>
        <h2 className="text-lg font-extrabold">{copy.language}</h2>
        <p className="mt-1 text-sm text-muted">{copy.languageHint}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setLocale('he')}
            className={`h-11 rounded-xl border text-sm font-bold ${locale === 'he' ? 'anan-accent-soft' : 'border-line'}`}
          >
            {messages.lang.he}
          </button>
          <button
            type="button"
            onClick={() => setLocale('ar')}
            className={`h-11 rounded-xl border text-sm font-bold ${locale === 'ar' ? 'anan-accent-soft' : 'border-line'}`}
          >
            {messages.lang.ar}
          </button>
        </div>
      </Panel>
      <Panel>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSettings({ phone, zones }).catch(() => undefined);
          }}
        >
          <h2 className="text-lg font-extrabold">{copy.phone}</h2>
          <p className="text-sm text-muted">{copy.phoneHint}</p>
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
          <PrimaryButton type="submit">{copy.save}</PrimaryButton>
        </form>
      </Panel>
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">{copy.zones}</h2>
          <PrimaryButton type="button" onClick={openZone}>
            <Plus className="size-4" aria-hidden="true" />
            {copy.addZone}
          </PrimaryButton>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted">{copy.zonesNote}</p>
        <ul className="mt-3 divide-y divide-line">
          {zones.map((zone) => (
            <li key={zone.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {zone.nameHe}
                {zone.nameAr ? <span className="font-medium text-muted"> · {zone.nameAr}</span> : null}
              </span>
              <span className="text-sm tabular-nums">₪{zone.priceMinor / 100}</span>
              <button
                type="button"
                role="switch"
                aria-checked={zone.active}
                aria-label={copy.active}
                onClick={() =>
                  commitZones(zones.map((item) => (item.id === zone.id ? { ...item, active: !item.active } : item)))
                }
                className={`relative h-6 w-11 rounded-full ${zone.active ? 'anan-accent-fill' : 'bg-line'}`}
              >
                <span className={`absolute top-0.5 size-5 rounded-full bg-white ${zone.active ? 'end-0.5' : 'start-0.5'}`} />
              </button>
              <IconButton
                type="button"
                aria-label={copy.remove}
                onClick={() => commitZones(zones.filter((item) => item.id !== zone.id))}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      </Panel>
      {zoneOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={() => setZoneOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="zone-dialog-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-[0_16px_40px_rgb(23_32_51/0.16)]"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={saveZone}
          >
            <div className="flex items-center gap-2">
              <button type="button" aria-label={copy.zoneClose} onClick={() => setZoneOpen(false)} className="inline-flex size-8 items-center justify-center text-ink">
                <X className="size-4" aria-hidden="true" />
              </button>
              <h3 id="zone-dialog-title" className="text-lg font-extrabold text-ink">
                {copy.addZone}
              </h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.zoneHint}</p>
            <div className="mt-5 space-y-4">
              <Field label={copy.zoneNameHe}>
                <TextInput
                  value={nameHe}
                  onChange={(event) => setNameHe(event.target.value)}
                  className={invalid && !nameHe.trim() ? 'border-brand-red' : ''}
                  required
                  autoFocus
                />
              </Field>
              <Field label={copy.zoneNameAr}>
                <TextInput value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.zonePrice}>
                  <TextInput
                    value={price}
                    inputMode="decimal"
                    onChange={(event) => setPrice(event.target.value)}
                    className={invalid && (!Number.isFinite(Number(price)) || Number(price) < 0 || price.trim() === '') ? 'border-brand-red' : ''}
                    required
                  />
                </Field>
                <Field label={copy.zoneSort}>
                  <TextInput
                    value={sortOrder}
                    inputMode="numeric"
                    onChange={(event) => setSortOrder(event.target.value)}
                    required
                  />
                </Field>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">{copy.active}</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setActive((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pe-1 ps-3 text-sm font-semibold text-ink"
                >
                  <span>{copy.active}</span>
                  <span className={`relative h-6 w-11 rounded-full ${active ? 'anan-accent-fill' : 'bg-line'}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white ${active ? 'end-0.5' : 'start-0.5'}`} />
                  </span>
                </button>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
              <GhostButton type="button" onClick={() => setZoneOpen(false)}>
                {copy.zoneCancel}
              </GhostButton>
              <PrimaryButton type="submit">{copy.zoneSave}</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
