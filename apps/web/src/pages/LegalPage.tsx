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
      <div className="mt-6 max-w-3xl space-y-4">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-7 text-ink">
            {paragraph}
          </p>
        ))}
      </div>
      <Link to="/checkout" className="mt-8 inline-block text-sm font-bold text-brand-blue underline">
        {messages.checkout.title}
      </Link>
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

export function ContactPage() {
  const { messages } = useI18n();
  return <LegalPage title={messages.legal.contactTitle} paragraphs={messages.legal.contact} />;
}
