import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type SectionHeaderProps = {
  id?: string;
  title: string;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
  actions?: ReactNode;
};

export function SectionHeader({
  id,
  title,
  subtitle,
  href,
  actionLabel,
  actions,
}: SectionHeaderProps) {
  const link =
    href && actionLabel ? (
      <Link to={href} className="shrink-0 text-sm font-semibold text-brand-blue">
        {actionLabel}
      </Link>
    ) : null;

  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-lg font-extrabold text-ink sm:text-xl">
          <span className="h-5 w-1 shrink-0 rounded-full bg-brand-red" aria-hidden="true" />
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs leading-5 text-muted sm:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {link || actions ? (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {link}
        </div>
      ) : null}
    </div>
  );
}
