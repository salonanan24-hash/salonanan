import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { Container } from './Container';

type StatusPageProps = {
  title: string;
  body: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function StatusPage({
  title,
  body,
  primaryHref = '/',
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: StatusPageProps) {
  const { messages } = useI18n();
  usePageTitle(title);
  const primary = primaryLabel ?? messages.common.home;

  return (
    <Container className="py-14 sm:py-20">
      <p className="text-sm font-semibold text-brand-red">{messages.status.badge}</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{body}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={primaryHref}
          className="inline-flex h-11 items-center bg-brand-blue px-5 text-sm font-semibold text-white hover:bg-brand-blue-dark"
        >
          {primary}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            to={secondaryHref}
            className="inline-flex h-11 items-center border border-line bg-white px-5 text-sm font-semibold text-ink"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </Container>
  );
}
