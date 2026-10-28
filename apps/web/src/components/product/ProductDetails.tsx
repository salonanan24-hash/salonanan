import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ProductDetails as Details, ProductDetail } from '@/data/catalog';
import { useI18n } from '@/i18n';

type ProductDetailsProps = {
  name: string;
  details: Details;
};

function paragraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function displayValue(value: string, yes: string, no: string): string {
  if (value === 'yes' || value === 'true') return yes;
  if (value === 'no' || value === 'false') return no;
  return value;
}

export function ProductDetails({ name, details }: ProductDetailsProps) {
  const { locale, messages } = useI18n();
  const copy = messages.product;
  const blocks = [
    { id: 'spec' as const, title: copy.spec, items: details.spec },
    { id: 'features' as const, title: copy.features, items: details.features },
    { id: 'info' as const, title: copy.info, items: details.info },
  ].filter((block) => block.items.length > 0);
  const [open, setOpen] = useState<string | null>(null);
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        const expanded = open === block.id;
        return (
          <section key={block.id} className="overflow-hidden rounded-md bg-white">
            <h2>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : block.id)}
                className={`flex w-full items-center justify-between gap-3 border bg-white px-4 py-3 text-start ${
                  expanded ? 'rounded-t-md border-brand-blue' : 'rounded-md border-line'
                }`}
              >
                <span className="text-base font-bold text-ink">{block.title}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-brand-blue transition ${expanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </h2>
            {expanded && block.id === 'features' ? (
              <dl>
                {block.items.map((item) => (
                  <div
                    key={item.label.he + item.label.ar + item.value.he}
                    className="grid grid-cols-[minmax(7rem,1fr)_minmax(0,1.5fr)_minmax(7rem,1fr)] items-center border-b border-[#e7ebf2] px-5 py-4 last:border-b-0"
                  >
                    <dt className="text-sm font-bold text-ink">{item.label[locale]}</dt>
                    <dd className="text-center text-sm text-ink">{displayValue(item.value[locale], copy.yes, copy.no)}</dd>
                    <span aria-hidden="true" />
                  </div>
                ))}
              </dl>
            ) : null}
            {expanded && block.id !== 'features' ? (
              <div className="border border-t-0 border-brand-blue px-4 py-5 sm:px-6">
                {block.id === 'spec' ? <SpecBody name={name} items={block.items} /> : null}
                {block.id === 'info' ? (
                  <div className="space-y-5">
                    {block.items.map((item) => (
                      <div key={item.label.he + item.label.ar}>
                        <h4 className="text-sm font-extrabold text-ink">{item.label[locale]}</h4>
                        <ul className="mt-2 list-disc space-y-2 ps-5 text-sm leading-7 text-ink">
                          {paragraphs(item.value[locale]).map((line, index) => (
                            <li key={index}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function SpecBody({ name, items }: { name: string; items: ProductDetail[] }) {
  const { locale } = useI18n();
  return (
    <div className="max-w-3xl">
      <h3 className="text-base font-extrabold text-ink">{name}</h3>
      {items.map((item) => (
        <div key={item.label.he + item.label.ar} className="mt-4">
          <h4 className="text-sm font-extrabold text-ink">{item.label[locale]}</h4>
          {paragraphs(item.value[locale]).map((line, index) => (
            <p key={index} className="mt-3 text-sm leading-7 text-ink">
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
