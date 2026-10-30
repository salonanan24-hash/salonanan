import { isAdminEmail } from '@anan/shared';
import { Pencil } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { readCoverImage } from '@/admin/images';
import { adminRequest } from '@/admin/remote';
import { useAuth } from '@/auth/auth-context';
import { useDevelopmentCatalog } from '@/hooks/use-catalog';
import { useI18n } from '@/i18n';
import { apiBase } from '@/lib/api-url';
import { TargetPicker, adHref, type TargetKind } from '@/components/home/HomeAds';

const apiUrl = apiBase();

export const sectionKeys = ['featured', 'fridges', 'laundry', 'entertainment', 'tech', 'kitchen'] as const;
export type SectionKey = (typeof sectionKeys)[number];
type Layout = 'above' | 'beside';

type SectionAd = {
  id: string;
  image: string;
  targetKind: TargetKind;
  targetRef: string;
  section: SectionKey;
  layout: Layout;
};

type StorePackage = { id: string; name: { he: string; ar: string } };

const SectionAdsContext = createContext<{
  ads: SectionAd[] | null;
  setAds: (ads: SectionAd[]) => void;
} | null>(null);

export function SectionAdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<SectionAd[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/api/home-ads?placement=section`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('ads'))))
      .then((body: { ads: SectionAd[] }) => {
        if (active) setAds(Array.isArray(body.ads) ? body.ads.filter((ad) => ad.section && ad.layout && ad.image) : []);
      })
      .catch(() => {
        if (active) setAds([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return <SectionAdsContext.Provider value={{ ads, setAds }}>{children}</SectionAdsContext.Provider>;
}

const sizes = {
  above: { width: 1920, height: 130 },
  beside: { width: 760, height: 740 },
} as const;

export function SectionSlot({
  section,
  children,
}: {
  section: SectionKey;
  children: (slot: { above: ReactNode; aside: ReactNode; beside: boolean }) => ReactNode;
}) {
  const context = useContext(SectionAdsContext);
  const { messages } = useI18n();
  const copy = messages.home.ads;
  const auth = useAuth();
  const admin = auth.ready && isAdminEmail(auth.user?.email);
  const { data: catalog } = useDevelopmentCatalog();
  const [editing, setEditing] = useState(false);
  const [packages, setPackages] = useState<StorePackage[]>([]);
  const ad = context?.ads?.find((item) => item.section === section) ?? null;
  const needsPackages = ad?.targetKind === 'package' || editing;

  useEffect(() => {
    if (!needsPackages) return;
    let active = true;
    fetch(`${apiUrl}/api/packages`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('packages'))))
      .then((body: { packages: StorePackage[] }) => {
        if (active) setPackages(body.packages ?? []);
      })
      .catch(() => {
        if (active) setPackages([]);
      });
    return () => {
      active = false;
    };
  }, [needsPackages]);

  const beside = ad?.layout === 'beside';
  const banner = ad ? <SectionBanner ad={ad} catalog={catalog} packages={packages} fill={beside} /> : null;

  return (
    <>
      {admin ? (
        <div className="mb-2 flex">
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-blue px-3 text-sm font-bold text-brand-blue"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {editing ? copy.close : copy.sectionEdit}
          </button>
        </div>
      ) : null}
      {editing && context ? (
        <SectionEditor
          section={section}
          current={ad}
          ads={context.ads}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            context.setAds(next);
            setEditing(false);
          }}
        />
      ) : null}
      {children({
        above: ad?.layout === 'above' ? <div className="mb-4">{banner}</div> : null,
        aside: beside ? banner : null,
        beside,
      })}
    </>
  );
}

function SectionBanner({
  ad,
  catalog,
  packages,
  fill,
}: {
  ad: SectionAd;
  catalog: ReturnType<typeof useDevelopmentCatalog>['data'];
  packages: StorePackage[];
  fill: boolean;
}) {
  const href = adHref(ad, catalog, packages);
  const image = (
    <img
      src={ad.image}
      alt=""
      className={
        fill
          ? 'aspect-[760/740] h-auto w-full rounded-2xl object-cover xl:aspect-auto xl:h-full'
          : 'aspect-[1920/130] h-auto w-full rounded-2xl object-cover'
      }
    />
  );
  if (!href) return image;
  return (
    <Link to={href} className={fill ? 'block h-full' : 'block'}>
      {image}
    </Link>
  );
}

function SectionEditor({
  section,
  current,
  ads,
  onClose,
  onSaved,
}: {
  section: SectionKey;
  current: SectionAd | null;
  ads: SectionAd[] | null;
  onClose: () => void;
  onSaved: (ads: SectionAd[]) => void;
}) {
  const { messages } = useI18n();
  const copy = messages.home.ads;
  const { data: catalog } = useDevelopmentCatalog();
  const [packages, setPackages] = useState<StorePackage[]>([]);
  const [layout, setLayout] = useState<Layout>(current?.layout ?? 'above');
  const [image, setImage] = useState(current?.image ?? '');
  const [targetKind, setTargetKind] = useState<TargetKind>(current?.targetKind ?? 'none');
  const [targetRef, setTargetRef] = useState(current?.targetRef ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const kinds: TargetKind[] = ['none', 'category', 'subcategory', 'brand', 'product', 'package'];

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/api/packages`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('packages'))))
      .then((body: { packages: StorePackage[] }) => {
        if (active) setPackages(body.packages ?? []);
      })
      .catch(() => {
        if (active) setPackages([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(remove: boolean) {
    if (!ads || (!remove && !image)) return;
    setStatus('saving');
    const next = ads.filter((item) => item.section !== section);
    if (!remove) {
      next.push({
        id: current?.id ?? `section-${section}`,
        image,
        targetKind: targetRef && targetKind !== 'none' ? targetKind : 'none',
        targetRef: targetRef && targetKind !== 'none' ? targetRef : '',
        section,
        layout,
      });
    }
    try {
      await adminRequest('/api/admin/home-ads', {
        method: 'PUT',
        body: JSON.stringify({ placement: 'section', ads: next }),
      });
      onSaved(next);
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="mb-3 rounded-2xl border border-line bg-white p-4">
      <p className="text-xs leading-5 text-muted">{layout === 'above' ? copy.aboveSize : copy.besideSize}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['above', 'beside'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={layout === item}
            onClick={() => {
              if (item === layout) return;
              setLayout(item);
              setImage('');
              setStatus('idle');
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              layout === item ? 'border-brand-blue text-brand-blue' : 'border-line text-ink'
            }`}
          >
            {copy[item]}
          </button>
        ))}
      </div>
      {image ? (
        <img
          src={image}
          alt=""
          className={`mt-3 rounded-lg object-cover ${layout === 'above' ? 'aspect-[1920/130] w-full' : 'aspect-[760/740] w-40'}`}
        />
      ) : null}
      <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-lg border border-dashed border-line px-3 text-xs font-semibold text-muted">
        {image ? copy.replace : copy.image}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const size = sizes[layout];
            void readCoverImage(file, size.width, size.height).then((src) => {
              setImage(src);
              setStatus('idle');
            });
          }}
        />
      </label>
      <p className="mt-3 text-xs font-bold text-ink">{copy.target}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={targetKind === kind}
            onClick={() => {
              setTargetKind(kind);
              setTargetRef('');
              setStatus('idle');
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              targetKind === kind ? 'border-brand-blue text-brand-blue' : 'border-line text-ink'
            }`}
          >
            {copy[kind]}
          </button>
        ))}
      </div>
      {targetKind === 'none' ? null : (
        <TargetPicker kind={targetKind} value={targetRef} catalog={catalog} packages={packages} onChange={setTargetRef} />
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!image || !ads || status === 'saving'}
          onClick={() => void save(false)}
          className="inline-flex h-10 items-center rounded-lg bg-brand-blue px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === 'saving' ? copy.saving : copy.save}
        </button>
        {current ? (
          <button type="button" className="text-xs font-bold text-brand-red" onClick={() => void save(true)}>
            {copy.remove}
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="text-sm font-bold text-muted">
          {copy.close}
        </button>
        {status === 'failed' ? <p className="text-sm font-bold text-brand-red">{copy.failed}</p> : null}
      </div>
    </div>
  );
}
