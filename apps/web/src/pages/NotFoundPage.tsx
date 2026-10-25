import { StatusPage } from '@/components/ui/StatusPage';
import { useI18n } from '@/i18n';

export function NotFoundPage() {
  const { messages } = useI18n();
  return <StatusPage title={messages.notFound.title} body={messages.notFound.body} />;
}
