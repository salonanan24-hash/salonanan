import { formatMoney, ils } from '@anan/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { readResizedImages } from '@/admin/images';
import { fillProductFromLink } from '@/admin/remote';
import { nid, useAdminStore } from '@/admin/store';
import type { AdminField, AdminProduct, AdminVariant, FieldSection } from '@/admin/types';
import {
  EmptyNote,
  Field,
  IconButton,
  PageHeader,
  Panel,
  PrimaryButton,
  SearchBox,
  SelectInput,
  Split,
  TextArea,
  TextInput,
} from '@/admin/ui';
import { fill, useI18n } from '@/i18n';

type Draft = {
  id: string | null;
  nameHe: string;
  nameAr: string;
  price: string;
  brandId: string;
  categoryId: string;
  subcategoryId: string;
  specs: Record<string, string>;
  specsAr: Record<string, string>;
  variants: AdminVariant[];
};

function blankVariant(): AdminVariant {
  return { id: nid('var'), color: '', colorHex: '#172033', stock: 0, active: true, images: [] };
}

function blankDraft(brandId = '', categoryId = ''): Draft {
  return {
    id: null,
    nameHe: '',
    nameAr: '',
    price: '',
    brandId,
    categoryId,
    subcategoryId: '',
    specs: {},
    specsAr: {},
    variants: [blankVariant()],
  };
}

function major(amountMinor: number): string {
  return String(amountMinor / 100);
}

export function ProductsPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.products;
  const categories = useAdminStore((state) => state.categories);
  const brands = useAdminStore((state) => state.brands);
  const products = useAdminStore((state) => state.products);
  const saveProduct = useAdminStore((state) => state.saveProduct);
  const removeProduct = useAdminStore((state) => state.removeProduct);
  const refresh = useAdminStore((state) => state.refresh);
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft>(() => blankDraft());
  const [agentModel, setAgentModel] = useState('');
  const [agentUrl, setAgentUrl] = useState('');
  const [agentFile, setAgentFile] = useState<File | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentNote, setAgentNote] = useState('');

  const category = categories.find((item) => item.id === draft.categoryId);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter && product.categoryId !== categoryFilter) return false;
      if (!needle) return true;
      const brand = brands.find((item) => item.id === product.brandId)?.name ?? '';
      const productCategory = categories.find((item) => item.id === product.categoryId);
      const subcategory = productCategory?.subcategories.find((item) => item.id === product.subcategoryId);
      const haystack = [
        product.name.he,
        product.name.ar,
        brand,
        productCategory?.name.he,
        productCategory?.name.ar,
        subcategory?.name.he,
        subcategory?.name.ar,
        ...Object.values(product.specs),
        ...Object.values(product.specsAr),
        ...product.variants.map((variant) => variant.color),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [brands, categories, categoryFilter, products, query]);

  function edit(product: AdminProduct) {
    setError('');
    setDraft({
      id: product.id,
      nameHe: product.name.he,
      nameAr: product.name.ar,
      price: major(product.priceMinor),
      brandId: product.brandId,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      specs: product.specs,
      specsAr: product.specsAr,
      variants: product.variants.length > 0 ? product.variants : [blankVariant()],
    });
  }

  function onCategory(categoryId: string) {
    const next = categories.find((item) => item.id === categoryId);
    setDraft((current) => ({
      ...current,
      categoryId,
      subcategoryId: next?.subcategories.some((item) => item.id === current.subcategoryId)
        ? current.subcategoryId
        : '',
    }));
  }

  function updateVariant(id: string, patch: Partial<AdminVariant>) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)),
    }));
  }

  async function addImages(id: string, list: FileList | null) {
    if (!list?.length) return;
    const sources = await readResizedImages(list);
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.id === id
          ? {
              ...variant,
              images: [...variant.images, ...sources.map((src) => ({ id: nid('img'), src }))],
            }
          : variant,
      ),
    }));
  }

  async function fillFromLink() {
    if (!agentModel.trim()) {
      setAgentNote(copy.agentFailed);
      return;
    }
    setAgentBusy(true);
    setAgentNote(copy.agentWorking);
    try {
      const result = await fillProductFromLink({ model: agentModel.trim(), url: agentUrl.trim() });
      const sources = agentFile ? await readResizedImages([agentFile]) : [];
      await refresh();
      setDraft((current) => {
        const variants = current.variants.length > 0 ? current.variants : [blankVariant()];
        const first = variants[0] ?? blankVariant();
        return {
          ...current,
          nameHe: result.draft.nameHe,
          nameAr: result.draft.nameAr,
          brandId: result.draft.brandId,
          categoryId: result.draft.categoryId,
          subcategoryId: result.draft.subcategoryId,
          specs: result.draft.specs,
          specsAr: result.draft.specsAr,
          variants: [
            {
              ...first,
              images: [
                ...sources.map((src) => ({ id: nid('img'), src })),
                ...first.images,
              ],
            },
            ...variants.slice(1),
          ],
        };
      });
      const added = [result.created.brand, result.created.category, result.created.subcategory, ...result.created.fields].filter(
        (item): item is string => Boolean(item),
      );
      setAgentNote(added.length > 0 ? `${copy.agentDone} ${fill(copy.agentAdded, { items: added.join(', ') })}` : copy.agentDone);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      setAgentNote(code === 'agent_unconfigured' ? copy.agentUnconfigured : code === 'page_blocked' ? copy.agentBlocked : copy.agentFailed);
    } finally {
      setAgentBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shekels = Number(draft.price);
    if (!draft.nameHe.trim() || !Number.isFinite(shekels) || shekels < 0 || !draft.brandId || !draft.categoryId) {
      setError(copy.required);
      return;
    }
    const allowed = new Set(category?.fields.map((item) => item.id) ?? []);
    const specs = Object.fromEntries(
      Object.entries(draft.specs).filter(([key, value]) => allowed.has(key) && value.trim() !== ''),
    );
    const specsAr = Object.fromEntries(
      Object.entries(draft.specsAr).filter(([key, value]) => allowed.has(key) && specs[key] && value.trim() !== ''),
    );
    const product: AdminProduct = {
      id: draft.id ?? nid('product'),
      name: { he: draft.nameHe.trim(), ar: draft.nameAr.trim() || draft.nameHe.trim() },
      priceMinor: Math.round(shekels * 100),
      brandId: draft.brandId,
      categoryId: draft.categoryId,
      subcategoryId: draft.subcategoryId,
      specs,
      specsAr,
      variants: draft.variants.map((variant) => ({
        ...variant,
        color: variant.color.trim(),
        stock: Math.max(0, Math.round(Number(variant.stock) || 0)),
      })),
    };
    saveProduct(product)
      .then(() => {
        setError('');
        setDraft(blankDraft(draft.brandId, draft.categoryId));
      })
      .catch(() => setError(messages.desk.saveFailed));
  }

  return (
    <div>
      <PageHeader title={copy.title} subtitle={messages.desk.savedHere} />
      <Split
        className="lg:grid-cols-2"
        list={
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <SearchBox value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
              <SelectInput
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label={copy.category}
              >
                <option value="">{copy.allCategories}</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name[locale]}
                  </option>
                ))}
              </SelectInput>
            </div>
            {filtered.length === 0 ? <EmptyNote>{products.length === 0 ? copy.empty : copy.noMatches}</EmptyNote> : null}
            <ul className="space-y-3">
              {filtered.map((product) => {
                const image = product.variants.find((variant) => variant.images[0])?.images[0]?.src;
                const brand = brands.find((item) => item.id === product.brandId);
                const cat = categories.find((item) => item.id === product.categoryId);
                return (
                  <li key={product.id}>
                    <Panel className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold tracking-wide text-muted">{cat?.name[locale]}</p>
                        <p className="truncate font-bold text-ink">
                          {product.name[locale]} — {formatMoney(ils(product.priceMinor), locale)}
                        </p>
                        <p className="truncate text-xs text-muted">{brand?.name}</p>
                      </div>
                      {image ? (
                        <img src={image} alt="" className="size-14 rounded-xl bg-[#f3f5f8] object-contain" />
                      ) : (
                        <span className="size-14 rounded-xl bg-[#f3f5f8]" />
                      )}
                      <div className="flex flex-col gap-2">
                        <IconButton type="button" onClick={() => edit(product)}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                          {copy.edit}
                        </IconButton>
                        <IconButton
                          type="button"
                          onClick={() => {
                            if (window.confirm(copy.removeConfirm)) void removeProduct(product.id);
                          }}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          {copy.remove}
                        </IconButton>
                      </div>
                    </Panel>
                  </li>
                );
              })}
            </ul>
          </div>
        }
        form={
          <Panel>
            <form className="space-y-4" onSubmit={onSubmit}>
              <h2 className="text-lg font-extrabold">{draft.id ? copy.edit : copy.add}</h2>
              <div className="space-y-3 rounded-2xl border border-line p-3">
                <div>
                  <p className="text-sm font-extrabold">{copy.agentTitle}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{copy.agentHint}</p>
                </div>
                <Field label={copy.agentModel}>
                  <TextInput value={agentModel} onChange={(event) => setAgentModel(event.target.value)} />
                </Field>
                <Field label={copy.agentUrl} hint={copy.optional}>
                  <TextInput value={agentUrl} inputMode="url" onChange={(event) => setAgentUrl(event.target.value)} />
                </Field>
                <Field label={copy.agentImage} hint={copy.optional}>
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted">
                    {agentFile ? agentFile.name : copy.agentImage}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        setAgentFile(event.target.files?.[0] ?? null);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </Field>
                <PrimaryButton type="button" disabled={agentBusy} onClick={() => void fillFromLink()}>
                  {agentBusy ? copy.agentWorking : copy.agentRun}
                </PrimaryButton>
                {agentNote ? <p className="text-sm text-muted">{agentNote}</p> : null}
              </div>
              <Field label={copy.name}>
                <TextInput value={draft.nameHe} onChange={(event) => setDraft({ ...draft, nameHe: event.target.value })} required />
              </Field>
              <Field label={copy.nameAr} hint={copy.optional}>
                <TextInput value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} />
              </Field>
              <Field label={copy.price} hint={copy.priceHint}>
                <TextInput
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                  required
                />
              </Field>
              <Field label={copy.brand}>
                <SelectInput value={draft.brandId} onChange={(event) => setDraft({ ...draft, brandId: event.target.value })} required>
                  <option value="">{copy.choose}</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={copy.category}>
                <SelectInput value={draft.categoryId} onChange={(event) => onCategory(event.target.value)} required>
                  <option value="">{copy.choose}</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name[locale]}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              {category && category.subcategories.length > 0 ? (
                <Field label={copy.subcategory} hint={copy.optional}>
                  <SelectInput
                    value={draft.subcategoryId}
                    onChange={(event) => setDraft({ ...draft, subcategoryId: event.target.value })}
                  >
                    <option value="">{copy.none}</option>
                    {category.subcategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name[locale]}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              ) : null}
              {category ? (
                <div className="space-y-4 rounded-2xl bg-[#f6f8fb] p-3">
                  <p className="text-sm font-bold text-ink">{copy.specs}</p>
                  <p className="text-xs leading-5 text-muted">{copy.optional}</p>
                  {category.fields.length === 0 ? <p className="text-sm text-muted">{copy.noSpecs}</p> : null}
                  {(['spec', 'features', 'info'] as const).map((section) => (
                    <ProductFields
                      key={section}
                      section={section}
                      fields={category.fields.filter((item) => (item.section ?? 'features') === section)}
                      specs={draft.specs}
                      specsAr={draft.specsAr}
                      onChange={(id, value) => setDraft({ ...draft, specs: { ...draft.specs, [id]: value } })}
                      onChangeAr={(id, value) => setDraft({ ...draft, specsAr: { ...draft.specsAr, [id]: value } })}
                    />
                  ))}
                </div>
              ) : null}
              <VariantEditor
                variants={draft.variants}
                onChange={updateVariant}
                onAdd={() => setDraft({ ...draft, variants: [...draft.variants, blankVariant()] })}
                onRemove={(id) =>
                  setDraft({ ...draft, variants: draft.variants.filter((variant) => variant.id !== id) })
                }
                onImages={(id, list) => void addImages(id, list)}
              />
              {error ? <p className="text-sm font-semibold anan-accent-text">{error}</p> : null}
              <div className="flex gap-2">
                <PrimaryButton type="submit" className="flex-1">
                  {copy.save}
                </PrimaryButton>
                <button
                  type="button"
                  className="h-11 rounded-xl px-3 text-sm font-semibold text-muted"
                  onClick={() => {
                    setDraft(blankDraft());
                    setError('');
                  }}
                >
                  {copy.cancel}
                </button>
              </div>
            </form>
          </Panel>
        }
      />
    </div>
  );
}

function VariantEditor({
  variants,
  onChange,
  onAdd,
  onRemove,
  onImages,
}: {
  variants: AdminVariant[];
  onChange: (id: string, patch: Partial<AdminVariant>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onImages: (id: string, list: FileList | null) => void;
}) {
  const { messages } = useI18n();
  const copy = messages.desk.products;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold">{copy.variants}</h3>
        <PrimaryButton type="button" className="h-9 px-3 text-xs" onClick={onAdd}>
          {copy.addVariant}
        </PrimaryButton>
      </div>
      {variants.map((variant, index) => (
        <div key={variant.id} className="rounded-2xl border border-line p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">{fill(copy.variant, { n: index + 1 })}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={variant.active}
                aria-label={copy.active}
                onClick={() => onChange(variant.id, { active: !variant.active })}
                className={`relative h-6 w-11 rounded-full ${variant.active ? 'anan-accent-fill' : 'bg-line'}`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white ${variant.active ? 'end-0.5' : 'start-0.5'}`}
                />
              </button>
              <IconButton type="button" onClick={() => onRemove(variant.id)} aria-label={copy.remove}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={copy.color} hint={copy.optional}>
              <TextInput value={variant.color} onChange={(event) => onChange(variant.id, { color: event.target.value })} />
            </Field>
            <Field label={copy.colorHex}>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  value={variant.colorHex}
                  aria-label={copy.colorHex}
                  onChange={(event) => onChange(variant.id, { colorHex: event.target.value })}
                  className="size-11 shrink-0 rounded-xl border border-line bg-white p-1"
                />
                <TextInput value={variant.colorHex} onChange={(event) => onChange(variant.id, { colorHex: event.target.value })} />
              </span>
            </Field>
            <Field label={copy.stock}>
              <TextInput
                inputMode="numeric"
                value={String(variant.stock)}
                onChange={(event) => onChange(variant.id, { stock: Number(event.target.value) })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <p className="mb-2 text-sm font-semibold">{copy.images}</p>
            <div className="flex flex-wrap gap-2">
              {variant.images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className="relative"
                  onClick={() =>
                    onChange(variant.id, { images: variant.images.filter((item) => item.id !== image.id) })
                  }
                  aria-label={copy.removeImage}
                >
                  <img src={image.src} alt="" className="size-16 rounded-xl bg-[#f3f5f8] object-contain" />
                </button>
              ))}
            </div>
            <label className="mt-2 inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted">
              {copy.addImages}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  onImages(variant.id, event.target.files);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductFields({
  section,
  fields,
  specs,
  specsAr,
  onChange,
  onChangeAr,
}: {
  section: FieldSection;
  fields: AdminField[];
  specs: Record<string, string>;
  specsAr: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onChangeAr: (id: string, value: string) => void;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.desk.products;
  if (fields.length === 0) return null;
  const title = section === 'spec' ? copy.spec : section === 'features' ? copy.features : copy.info;

  return (
    <div className="space-y-3">
      <p className="text-sm font-extrabold text-ink">{title}</p>
      {fields.map((item) => {
        const bilingual = item.type !== 'boolean' && item.type !== 'number';
        return (
          <div key={item.id} className="space-y-2">
            <Field label={item.label[locale]} hint={section === 'features' ? undefined : copy.longText}>
              {section !== 'features' ? (
                <TextArea value={specs[item.id] ?? ''} onChange={(event) => onChange(item.id, event.target.value)} />
              ) : item.type === 'boolean' ? (
                <SelectInput value={specs[item.id] ?? ''} onChange={(event) => onChange(item.id, event.target.value)}>
                  <option value="">{copy.none}</option>
                  <option value="yes">{copy.yes}</option>
                  <option value="no">{copy.no}</option>
                </SelectInput>
              ) : (
                <TextInput
                  inputMode={item.type === 'number' ? 'decimal' : 'text'}
                  value={specs[item.id] ?? ''}
                  onChange={(event) => onChange(item.id, event.target.value)}
                />
              )}
            </Field>
            {bilingual ? (
              <Field label={copy.valueAr}>
                {section !== 'features' ? (
                  <TextArea value={specsAr[item.id] ?? ''} onChange={(event) => onChangeAr(item.id, event.target.value)} />
                ) : (
                  <TextInput value={specsAr[item.id] ?? ''} onChange={(event) => onChangeAr(item.id, event.target.value)} />
                )}
              </Field>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
