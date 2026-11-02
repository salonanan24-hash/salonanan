import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { readResizedImages } from '@/admin/images';
import { useAdminStore } from '@/admin/store';
import type { AdminCategory } from '@/admin/types';
import {
  EmptyNote,
  Field,
  IconButton,
  PageHeader,
  Panel,
  PrimaryButton,
  SearchBox,
  Split,
  TextInput,
} from '@/admin/ui';
import { byDisplayOrder } from '@/data/catalog';
import { useI18n } from '@/i18n';

type CategoryDraft = { id: string | null; slug: string; nameHe: string; nameAr: string; image: string; displayOrder: string };
type NamedDraft = { id: string | null; nameHe: string; nameAr: string; image: string; displayOrder: string };

const emptyCategory = (): CategoryDraft => ({ id: null, slug: '', nameHe: '', nameAr: '', image: '', displayOrder: '' });
const emptyNamed = (): NamedDraft => ({ id: null, nameHe: '', nameAr: '', image: '', displayOrder: '' });

export function CategoriesPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.categories;
  const categories = useAdminStore((state) => state.categories);
  const saveCategory = useAdminStore((state) => state.saveCategory);
  const removeCategory = useAdminStore((state) => state.removeCategory);
  const saveSubcategory = useAdminStore((state) => state.saveSubcategory);
  const removeSubcategory = useAdminStore((state) => state.removeSubcategory);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<CategoryDraft>(emptyCategory);
  const [subDraft, setSubDraft] = useState<NamedDraft>(emptyNamed);

  const selected = categories.find((item) => item.id === draft.id) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = !needle
      ? categories
      : categories.filter((item) => `${item.name.he} ${item.name.ar} ${item.slug}`.toLowerCase().includes(needle));
    return byDisplayOrder(matched);
  }, [categories, query]);

  function open(category: AdminCategory) {
    setNotice('');
    setDraft({
      id: category.id,
      slug: category.slug,
      nameHe: category.name.he,
      nameAr: category.name.ar,
      image: category.image,
      displayOrder: category.displayOrder == null ? '' : String(category.displayOrder),
    });
    setSubDraft(emptyNamed());
  }

  function onSaveCategory(event: FormEvent) {
    event.preventDefault();
    if (!draft.nameHe.trim()) return;
    const displayOrder = draft.displayOrder.trim();
    if (displayOrder !== '' && !/^\d{1,4}$/.test(displayOrder)) return;
    void saveCategory({
      id: draft.id ?? undefined,
      slug: draft.slug,
      nameHe: draft.nameHe,
      nameAr: draft.nameAr,
      image: draft.image,
      displayOrder: displayOrder === '' ? null : Number(displayOrder),
    })
      .then(() => {
        setDraft(emptyCategory());
        setNotice('');
      })
      .catch(() => setNotice(messages.desk.saveFailed));
  }

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <Split
        list={
          <div className="space-y-3">
            <SearchBox value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
            {filtered.length === 0 ? <EmptyNote>{copy.empty}</EmptyNote> : null}
            <Panel className="divide-y divide-line p-0">
              {filtered.map((category) => (
                <div key={category.id} className="flex items-center gap-3 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-start" onClick={() => open(category)}>
                    <p className="font-bold text-ink">{category.name[locale]}</p>
                    <p className="text-xs text-muted">
                      {category.slug}
                      {category.displayOrder == null ? '' : ` · ${category.displayOrder}`}
                    </p>
                  </button>
                  <IconButton type="button" onClick={() => open(category)} aria-label={copy.edit}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label={copy.remove}
                    onClick={() => {
                      if (!window.confirm(copy.removeConfirm)) return;
                      void removeCategory(category.id).then((removed) => {
                        if (!removed) setNotice(copy.inUse);
                        else if (draft.id === category.id) setDraft(emptyCategory());
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </IconButton>
                </div>
              ))}
            </Panel>
          </div>
        }
        form={
          <div className="space-y-4">
            <Panel>
              <form className="space-y-3" onSubmit={onSaveCategory}>
                <h2 className="text-lg font-extrabold">{draft.id ? copy.edit : copy.add}</h2>
                <Field label={copy.slug}>
                  <TextInput value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
                </Field>
                <Field label={copy.nameHe}>
                  <TextInput value={draft.nameHe} onChange={(event) => setDraft({ ...draft, nameHe: event.target.value })} required />
                </Field>
                <Field label={copy.nameAr}>
                  <TextInput value={draft.nameAr} onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })} />
                </Field>
                <Field label={copy.displayOrder}>
                  <TextInput
                    inputMode="numeric"
                    value={draft.displayOrder}
                    onChange={(event) => setDraft({ ...draft, displayOrder: event.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                  <p className="mt-1.5 text-xs text-muted">{copy.displayOrderHint}</p>
                </Field>
                <ImagePick
                  label={copy.image}
                  hint={copy.imageHint}
                  value={draft.image}
                  changeLabel={copy.changeImage}
                  removeLabel={copy.removeImage}
                  onChange={(image) => setDraft({ ...draft, image })}
                />
                <PrimaryButton type="submit" className="w-full">
                  {copy.save}
                </PrimaryButton>
              </form>
              {notice ? <p className="mt-3 text-sm font-semibold anan-accent-text">{notice}</p> : null}
            </Panel>
            {selected ? (
              <Panel>
                <h2 className="text-lg font-extrabold">{copy.subs}</h2>
                <p className="mt-1 text-sm text-muted">{selected.name[locale]}</p>
                <ul className="mt-3 divide-y divide-line">
                  {byDisplayOrder(selected.subcategories).map((item) => (
                    <li key={item.id} className="flex items-center gap-2 py-2">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-contain" />
                      ) : (
                        <span className="h-10 w-10 rounded-lg bg-[#f3f5f8]" />
                      )}
                      <span className="min-w-0 flex-1 text-sm font-semibold">
                        {item.name[locale]}
                        {item.displayOrder == null ? '' : ` · ${item.displayOrder}`}
                      </span>
                      <IconButton
                        type="button"
                        aria-label={copy.edit}
                        onClick={() =>
                          setSubDraft({
                            id: item.id,
                            nameHe: item.name.he,
                            nameAr: item.name.ar,
                            image: item.image,
                            displayOrder: item.displayOrder == null ? '' : String(item.displayOrder),
                          })
                        }
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        type="button"
                        aria-label={copy.remove}
                        onClick={() => void removeSubcategory(selected.id, item.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-3 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!subDraft.nameHe.trim()) return;
                    const displayOrder = subDraft.displayOrder.trim();
                    if (displayOrder !== '' && !/^\d{1,4}$/.test(displayOrder)) return;
                    void saveSubcategory(selected.id, {
                      id: subDraft.id ?? undefined,
                      nameHe: subDraft.nameHe,
                      nameAr: subDraft.nameAr,
                      image: subDraft.image,
                      displayOrder: displayOrder === '' ? null : Number(displayOrder),
                    })
                      .then(() => setSubDraft(emptyNamed()))
                      .catch(() => setNotice(messages.desk.saveFailed));
                  }}
                >
                  <Field label={subDraft.id ? copy.editSub : copy.addSub}>
                    <TextInput
                      value={subDraft.nameHe}
                      placeholder={copy.nameHe}
                      onChange={(event) => setSubDraft({ ...subDraft, nameHe: event.target.value })}
                    />
                  </Field>
                  <TextInput
                    value={subDraft.nameAr}
                    placeholder={copy.nameAr}
                    aria-label={copy.nameAr}
                    onChange={(event) => setSubDraft({ ...subDraft, nameAr: event.target.value })}
                  />
                  <Field label={copy.displayOrder}>
                    <TextInput
                      inputMode="numeric"
                      value={subDraft.displayOrder}
                      onChange={(event) =>
                        setSubDraft({ ...subDraft, displayOrder: event.target.value.replace(/\D/g, '').slice(0, 4) })
                      }
                    />
                    <p className="mt-1.5 text-xs text-muted">{copy.subDisplayOrderHint}</p>
                  </Field>
                  <ImagePick
                    label={copy.image}
                    hint={copy.imageHint}
                    value={subDraft.image}
                    changeLabel={copy.changeImage}
                    removeLabel={copy.removeImage}
                    onChange={(image) => setSubDraft({ ...subDraft, image })}
                  />
                  <PrimaryButton type="submit" className="w-full">
                    {copy.save}
                  </PrimaryButton>
                </form>
              </Panel>
            ) : (
              <EmptyNote>{copy.pick}</EmptyNote>
            )}
          </div>
        }
      />
    </div>
  );
}

function ImagePick({
  label,
  hint,
  value,
  changeLabel,
  removeLabel,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  changeLabel: string;
  removeLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="text-xs leading-5 text-muted">{hint}</p>
      {value ? <img src={value} alt="" className="h-24 w-full rounded-xl bg-[#f6f8fb] object-contain" /> : null}
      <div className="flex gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted">
          {value ? changeLabel : label}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void readResizedImages([file]).then(([src]) => {
                if (src) onChange(src);
              });
            }}
          />
        </label>
        {value ? (
          <button type="button" className="text-xs font-bold text-brand-red" onClick={() => onChange('')}>
            {removeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
