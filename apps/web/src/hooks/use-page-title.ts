import { useEffect } from 'react';
import { useI18n } from '@/i18n';

export function usePageTitle(title: string) {
  const { messages } = useI18n();

  useEffect(() => {
    document.title = `${title} | ${messages.brand.name}`;
  }, [title, messages.brand.name]);
}
