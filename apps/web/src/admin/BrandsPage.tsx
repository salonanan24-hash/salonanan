import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { readResizedImages } from '@/admin/images';
import { useAdminStore } from '@/admin/store';
import type { AdminBrand } from '@/admin/types';
import { EmptyNote, Field, IconButton, PageHeader, Panel, PrimaryButton, SearchBox, Split, TextInput } from '@/admin/ui';
import { useI18n } from '@/i18n';

export function BrandsPage() {
  const { messages } = useI18n();
  const copy = messages.desk.brands;
  const brands = useAdminStore((state) => state.brands);
  const saveBrand = useAdminStore((state) => state.saveBrand);
  const removeBrand = useAdminStore((state) => state.removeBrand);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<{ id: string | null; name: string; slug: string; image: string }>({
    id: null,
    name: '',
    slug: '',
    image: '',
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((brand) => `${brand.name} ${brand.slug}`.toLowerCase().includes(needle));
  }, [brands, query]);

  function open(brand: AdminBrand) {
    setNotice('');
    setDraft({ id: brand.id, name: brand.name, slug: brand.slug, image: brand.image });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    void saveBrand({ id: draft.id ?? undefined, name: draft.name, slug: draft.slug, image: draft.image })
      .then(() => {
        setDraft({ id: null, name: '', slug: '', image: '' });
        setNotice('');
      })
      .catch(() => setNotice(messages.desk.saveFailed));
  }

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.hint} />
      <Split
        list={
          <div className="space-y-3">
            <SearchBox value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
            {filtered.length === 0 ? <EmptyNote>{copy.empty}</EmptyNote> : null}
            <Panel className="divide-y divide-line p-0">
              {filtered.map((brand) => (
                <div key={brand.id} className="flex items-center gap-3 px-4 py-3">
                  {brand.image ? (
                    <img src={brand.image} alt="" className="h-10 w-14 rounded-lg bg-[#f6f8fb] object-contain" />
                  ) : (
                    <span className="h-10 w-14 rounded-lg bg-[#f3f5f8]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{brand.name}</p>
                    <p className="text-xs text-muted">{brand.slug}</p>
                  </div>
                  <IconButton type="button" aria-label={copy.edit} onClick={() => open(brand)}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label={copy.remove}
                    onClick={() => {
                      if (!window.confirm(copy.removeConfirm)) return;
                      void removeBrand(brand.id).then((removed) => {
                        if (!removed) setNotice(copy.inUse);
                        else if (draft.id === brand.id) setDraft({ id: null, name: '', slug: '', image: '' });
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
          <Panel>
            <form className="space-y-3" onSubmit={onSubmit}>
              <h2 className="text-lg font-extrabold">{draft.id ? copy.edit : copy.add}</h2>
              <Field label={copy.name}>
                <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
              </Field>
              <Field label={copy.slug}>
                <TextInput value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
              </Field>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">{copy.image}</p>
                <p className="text-xs leading-5 text-muted">{copy.imageHint}</p>
                {draft.image ? <img src={draft.image} alt="" className="h-16 w-full rounded-xl bg-[#f6f8fb] object-contain" /> : null}
                <div className="flex gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-line px-3 text-xs font-semibold text-muted">
                    {draft.image ? copy.changeImage : copy.image}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;
                        void readResizedImages([file]).then(([src]) => {
                          if (src) setDraft((current) => ({ ...current, image: src }));
                        });
                      }}
                    />
                  </label>
                  {draft.image ? (
                    <button type="button" className="text-xs font-bold text-brand-red" onClick={() => setDraft({ ...draft, image: '' })}>
                      {copy.removeImage}
                    </button>
                  ) : null}
                </div>
              </div>
              <PrimaryButton type="submit" className="w-full">
                {copy.save}
              </PrimaryButton>
              {notice ? <p className="text-sm font-semibold anan-accent-text">{notice}</p> : null}
            </form>
          </Panel>
        }
      />
    </div>
  );
}
