import type { BuyingGuide } from '@/data/listing';
import { useI18n } from '@/i18n';

export function BuyingGuideSection({ guide }: { guide: BuyingGuide }) {
  const { locale } = useI18n();

  return (
    <section className="mt-8 rounded-2xl border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <span className="h-5 w-1 rounded-full bg-brand-red" aria-hidden="true" />
        {guide.title[locale]}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{guide.body[locale]}</p>
    </section>
  );
}
