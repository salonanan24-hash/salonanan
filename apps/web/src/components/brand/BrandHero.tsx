import type { BrandProfile } from '@/data/listing';
import { useI18n } from '@/i18n';

export function BrandHero({ brand }: { brand: BrandProfile }) {
  const { messages } = useI18n();

  return (
    <section className="mt-6 text-center">
      {brand.kind === 'preview' ? (
        <p className="text-xs font-bold text-brand-red">{messages.brandPage.previewKicker}</p>
      ) : null}
      {brand.image ? (
        <h1>
          <img src={brand.image} alt={brand.name} className="mx-auto h-16 w-auto max-w-xs object-contain sm:h-20" />
        </h1>
      ) : (
        <h1 className="text-4xl font-extrabold text-ink">{brand.name}</h1>
      )}
    </section>
  );
}
