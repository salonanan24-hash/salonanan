import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { readResizedImages } from '@/admin/images';
import { useAdminStore } from '@/admin/store';
import type { AdminCategory, AdminField, FieldSection, FieldType } from '@/admin/types';
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
  TextInput,
} from '@/admin/ui';
import { useI18n } from '@/i18n';

type CategoryDraft = { id: string | null; slug: string; nameHe: string; nameAr: string; image: string };
type NamedDraft = { id: string | null; nameHe: string; nameAr: string; image: string };
type FieldDraft = { id: string | null; nameHe: string; nameAr: string; type: FieldType; section: FieldSection };

const sections: readonly FieldSection[] = ['spec', 'features', 'info'];

const emptyCategory = (): CategoryDraft => ({ id: null, slug: '', nameHe: '', nameAr: '', image: '' });
const emptyNamed = (): NamedDraft => ({ id: null, nameHe: '', nameAr: '', image: '' });

export function CategoriesPage() {
  const { locale, messages } = useI18n();
  const copy = messages.desk.categories;
  const categories = useAdminStore((state) => state.categories);
  const saveCategory = useAdminStore((state) => state.saveCategory);
  const removeCategory = useAdminStore((state) => state.removeCategory);
  const saveSubcategory = useAdminStore((state) => state.saveSubcategory);
  const removeSubcategory = useAdminStore((state) => state.removeSubcategory);
  const removeField = useAdminStore((state) => state.removeField);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<CategoryDraft>(emptyCategory);
  const [subDraft, setSubDraft] = useState<NamedDraft>(emptyNamed);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>({ ...emptyNamed(), type: 'text', section: 'features' });

  const selected = categories.find((item) => item.id === draft.id) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((item) => `${item.name.he} ${item.name.ar} ${item.slug}`.toLowerCase().includes(needle));
  }, [categories, query]);

  function open(category: AdminCategory) {
    setNotice('');
    setDraft({
      id: category.id,
      slug: category.slug,
      nameHe: category.name.he,
      nameAr: category.name.ar,
      image: category.image,
    });
    setSubDraft(emptyNamed());
    setFieldDraft({ ...emptyNamed(), type: 'text', section: 'features' });
  }

  function onSaveCategory(event: FormEvent) {
    event.preventDefault();
    if (!draft.nameHe.trim()) return;
    void saveCategory({
      id: draft.id ?? undefined,
      slug: draft.slug,
      nameHe: draft.nameHe,
      nameAr: draft.nameAr,
      image: draft.image,
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
                    <p className="text-xs text-muted">{category.slug}</p>
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
              <>
                <Panel>
                  <h2 className="text-lg font-extrabold">{copy.subs}</h2>
                  <p className="mt-1 text-sm text-muted">{selected.name[locale]}</p>
                  <ul className="mt-3 divide-y divide-line">
                    {selected.subcategories.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 py-2">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-contain" />
                        ) : (
                          <span className="h-10 w-10 rounded-lg bg-[#f3f5f8]" />
                        )}
                        <span className="min-w-0 flex-1 text-sm font-semibold">{item.name[locale]}</span>
                        <IconButton
                          type="button"
                          aria-label={copy.edit}
                          onClick={() =>
                            setSubDraft({ id: item.id, nameHe: item.name.he, nameAr: item.name.ar, image: item.image })
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
                      void saveSubcategory(selected.id, {
                        id: subDraft.id ?? undefined,
                        nameHe: subDraft.nameHe,
                        nameAr: subDraft.nameAr,
                        image: subDraft.image,
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
                {sections.map((section) => (
                  <FieldPanel
                    key={section}
                    section={section}
                    categoryId={selected.id}
                    fields={selected.fields.filter((item) => (item.section ?? 'features') === section)}
                    draft={fieldDraft}
                    setDraft={setFieldDraft}
                    onRemove={(fieldId) => void removeField(selected.id, fieldId)}
                    onError={() => setNotice(messages.desk.saveFailed)}
                  />
                ))}
              </>
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

function FieldPanel({
  section,
  categoryId,
  fields,
  draft,
  setDraft,
  onRemove,
  onError,
}: {
  section: FieldSection;
  categoryId: string;
  fields: AdminField[];
  draft: FieldDraft;
  setDraft: (draft: FieldDraft) => void;
  onRemove: (fieldId: string) => void;
  onError: () => void;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.desk.categories;
  const saveField = useAdminStore((state) => state.saveField);
  const active = draft.section === section;
  const title = section === 'spec' ? copy.sectionSpec : section === 'features' ? copy.sectionFeatures : copy.sectionInfo;
  const hint = section === 'spec' ? copy.sectionSpecHint : section === 'features' ? copy.sectionFeaturesHint : copy.sectionInfoHint;
  const current: FieldDraft = active ? draft : { ...emptyNamed(), type: 'text', section };

  return (
    <Panel>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{hint}</p>
      <ul className="mt-3 divide-y divide-line">
        {fields.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{item.label[locale]}</span>
              {section === 'features' ? <span className="ms-2 text-xs text-muted">{copy[item.type]}</span> : null}
            </span>
            <IconButton
              type="button"
              aria-label={copy.edit}
              onClick={() =>
                setDraft({
                  id: item.id,
                  nameHe: item.label.he,
                  nameAr: item.label.ar,
                  type: item.type,
                  section,
                })
              }
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </IconButton>
            <IconButton type="button" aria-label={copy.remove} onClick={() => onRemove(item.id)}>
              <Trash2 className="size-3.5" aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!current.nameHe.trim()) return;
          void saveField(categoryId, {
            id: current.id ?? undefined,
            nameHe: current.nameHe,
            nameAr: current.nameAr,
            type: section === 'features' ? current.type : 'text',
            section,
          })
            .then(() => setDraft({ ...emptyNamed(), type: 'text', section }))
            .catch(onError);
        }}
      >
        <Field label={current.id ? copy.editField : copy.addField}>
          <TextInput
            value={current.nameHe}
            placeholder={copy.nameHe}
            onChange={(event) => setDraft({ ...current, nameHe: event.target.value, section })}
          />
        </Field>
        <TextInput
          value={current.nameAr}
          placeholder={copy.nameAr}
          aria-label={copy.nameAr}
          onChange={(event) => setDraft({ ...current, nameAr: event.target.value, section })}
        />
        {section === 'features' ? (
          <SelectInput
            aria-label={copy.fieldType}
            value={current.type}
            onChange={(event) => setDraft({ ...current, type: event.target.value as FieldType, section })}
          >
            <option value="text">{copy.text}</option>
            <option value="number">{copy.number}</option>
            <option value="boolean">{copy.boolean}</option>
          </SelectInput>
        ) : null}
        <PrimaryButton type="submit" className="w-full">
          {copy.save}
        </PrimaryButton>
      </form>
    </Panel>
  );
}
