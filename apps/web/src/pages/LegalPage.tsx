import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { usePageTitle } from '@/hooks/use-page-title';
import { useI18n } from '@/i18n';

function LegalPage({ title, paragraphs }: { title: string; paragraphs: readonly string[] }) {
  const { messages } = useI18n();
  usePageTitle(title);

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">{messages.legal.company}</p>
      <p className="mt-1 text-xs text-muted">{messages.legal.updated}</p>
      <div className="mt-6 max-w-3xl space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={`${title}-${index}`} className="text-sm leading-7 text-ink">
            {paragraph}
          </p>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-4 text-sm font-bold text-brand-blue">
        <Link to="/" className="underline">
          {messages.common.home}
        </Link>
        <Link to="/contact" className="underline">
          {messages.nav.contact}
        </Link>
      </div>
    </Container>
  );
}

export function TermsPage() {
  const { messages } = useI18n();
  return <LegalPage title={messages.legal.termsTitle} paragraphs={messages.legal.terms} />;
}

export function PrivacyPage() {
  const { messages } = useI18n();
  return <LegalPage title={messages.legal.privacyTitle} paragraphs={messages.legal.privacy} />;
}

export function AccessibilityPage() {
  const { messages } = useI18n();
  return <LegalPage title={messages.legal.accessibilityTitle} paragraphs={messages.legal.accessibility} />;
}

export function CookiesPage() {
  const { messages } = useI18n();
  return <LegalPage title={messages.legal.cookiesTitle} paragraphs={messages.legal.cookies} />;
}
