import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';

export type Crumb = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  const { messages } = useI18n();

  return (
    <nav aria-label={messages.common.breadcrumb} className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <ChevronLeft className="h-3.5 w-3.5 text-line" aria-hidden="true" /> : null}
              {item.to && !last ? (
                <Link to={item.to} className="font-semibold text-brand-blue">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? 'text-ink' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
