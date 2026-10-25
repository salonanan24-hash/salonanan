import { formatMoney, ils } from '@anan/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { nid, useAdminStore } from '@/admin/store';
import { adminRequest } from '@/admin/remote';
import { Field, GhostButton, IconButton, PageHeader, Panel, PrimaryButton, SelectInput, TextInput } from '@/admin/ui';
import { useI18n } from '@/i18n';
import { Trash2 } from 'lucide-react';

type AdminPackage = {
  id: string;
  nameHe: string;
  nameAr: string;
  priceMinor: number;
  active: boolean;
  productIds: string[];
};

const empty = { id: '', nameHe: '', nameAr: '', price: '', active: true, productIds: [] as string[] };

export function PackagesPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.packages;
  const products = useAdminStore((state) => state.products);
  const categories = useAdminStore((state) => state.categories);
  const brands = useAdminStore((state) => state.brands);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [draft, setDraft] = useState(empty);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    adminRequest<{ packages: AdminPackage[] }>('/api/admin/packages')
      .then((result) => {
        if (active) setPackages(result.packages);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const choices = products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (!needle) return true;
    const brand = brands.find((item) => item.id === product.brandId)?.name ?? '';
    return `${product.name.he} ${product.name.ar} ${brand}`.toLowerCase().includes(needle);
  });

  function toggleProduct(id: string) {
    setDraft((current) => ({
      ...current,
      productIds: current.productIds.includes(id)
        ? current.productIds.filter((item) => item !== id)
        : [...current.productIds, id],
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const shekels = Number(draft.price);
    if (!draft.nameHe.trim() || !Number.isFinite(shekels) || shekels < 0) {
      setError(copy.invalid);
      return;
    }
    if (draft.productIds.length < 2) {
      setError(copy.needProducts);
      return;
    }
    const id = draft.id || nid('pkg');
    const next: AdminPackage = {
      id,
      nameHe: draft.nameHe.trim(),
      nameAr: draft.nameAr.trim(),
      priceMinor: Math.round(shekels * 100),
      active: draft.active,
      productIds: draft.productIds,
    };
    try {
      await adminRequest(`/api/admin/packages/${id}`, { method: 'PUT', body: JSON.stringify(next) });
      setPackages((current) => {
        const exists = current.some((item) => item.id === id);
        return exists ? current.map((item) => (item.id === id ? next : item)) : [...current, next];
      });
      setDraft(empty);
      setOpen(false);
      setError('');
    } catch {
      setError(messages.desk.saveFailed);
    }
  }

  async function remove(id: string) {
    await adminRequest(`/api/admin/packages/${id}`, { method: 'DELETE' });
    setPackages((current) => current.filter((item) => item.id !== id));
    if (draft.id === id) {
      setDraft(empty);
      setOpen(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <PageHeader title={copy.title} subtitle={copy.note} />
        <PrimaryButton
          type="button"
          onClick={() => {
            setDraft(empty);
            setError('');
            setOpen(true);
          }}
        >
          {copy.add}
        </PrimaryButton>
      </div>
      {open ? (
        <Panel className="mb-4">
          <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.nameHe}>
                <TextInput value={draft.nameHe} onChange={(event) => setDraft({ ...draft, nameHe: event.target.value })} required />
              </Field>
              <Field label={copy.nameAr}>
                <TextInput value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} />
              </Field>
            </div>
            <Field label={copy.price}>
              <TextInput
                value={draft.price}
                inputMode="decimal"
                onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                required
              />
            </Field>
            <div>
              <p className="text-sm font-semibold text-ink">{copy.products}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
                <SelectInput value={categoryId} aria-label={copy.allCategories} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">{copy.allCategories}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name[locale]}
                    </option>
                  ))}
                </SelectInput>
                <SelectInput value={brandId} aria-label={copy.allBrands} onChange={(event) => setBrandId(event.target.value)}>
                  <option value="">{copy.allBrands}</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </SelectInput>
              </div>
              {choices.length === 0 ? <p className="mt-2 text-sm text-muted">{copy.noMatches}</p> : null}
              <ul className="mt-2 max-h-80 space-y-1 overflow-auto rounded-xl border border-line p-2">
                {choices.map((product) => {
                  const selected = draft.productIds.includes(product.id);
                  const image = product.variants.find((variant) => variant.images[0])?.images[0]?.src;
                  const brand = brands.find((item) => item.id === product.brandId)?.name;
                  return (
                    <li key={product.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm ${selected ? 'bg-[#f4f7fb]' : ''}`}>
                        {image ? (
                          <img src={image} alt="" className="size-14 shrink-0 rounded-lg bg-[#f6f8fb] object-contain" />
                        ) : (
                          <span className="size-14 shrink-0 rounded-lg bg-[#f6f8fb]" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">{product.name[locale]}</span>
                          {brand ? <span className="block text-xs font-bold text-brand-blue">{brand}</span> : null}
                        </span>
                        <span className="shrink-0 text-muted">{formatMoney(ils(product.priceMinor), locale)}</span>
                        <input type="checkbox" checked={selected} onChange={() => toggleProduct(product.id)} />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-muted">{draft.productIds.length}</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              {copy.active}
            </label>
            {error ? <p className="text-sm font-semibold text-brand-red">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <GhostButton
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDraft(empty);
                  setError('');
                }}
              >
                {copy.cancel}
              </GhostButton>
              <PrimaryButton type="submit">{copy.save}</PrimaryButton>
            </div>
          </form>
        </Panel>
      ) : null}
      {packages.length === 0 ? <p className="text-sm text-muted">{copy.empty}</p> : null}
      <div className="space-y-3">
        {packages.map((item) => (
          <Panel key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 text-start"
                onClick={() => {
                  setDraft({
                    id: item.id,
                    nameHe: item.nameHe,
                    nameAr: item.nameAr === item.nameHe ? '' : item.nameAr,
                    price: String(item.priceMinor / 100),
                    active: item.active,
                    productIds: item.productIds,
                  });
                  setOpen(true);
                  setError('');
                }}
              >
                <p className="font-extrabold">{locale === 'ar' ? item.nameAr : item.nameHe}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatMoney(ils(item.priceMinor), locale)} · {item.productIds.length}
                </p>
              </button>
              <IconButton type="button" aria-label={copy.remove} onClick={() => void remove(item.id)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconButton>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
