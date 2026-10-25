import type { BrandProfile } from '@/data/listing';
import { useI18n } from '@/i18n';

export function BrandHero({ brand }: { brand: BrandProfile }) {
  const { locale, messages } = useI18n();

  return (
    <section className="mt-6 text-center">
      {brand.kind === 'preview' ? (
        <p className="text-xs font-bold text-brand-red">{messages.brandPage.previewKicker}</p>
      ) : null}
      <h1 className="text-4xl font-extrabold text-ink">{brand.name}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">{brand.summary[locale]}</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">{brand.disclaimer[locale]}</p>
    </section>
  );
}
