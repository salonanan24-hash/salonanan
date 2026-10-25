import { useI18n } from '@/i18n';

export function DevNotice() {
  const { messages } = useI18n();

  return (
    <p
      role="note"
      className="rounded-lg border border-line bg-white px-3 py-2 text-xs leading-5 text-ink"
    >
      {messages.devNotice}
    </p>
  );
}
