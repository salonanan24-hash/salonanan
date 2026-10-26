import type { Locale } from '@anan/shared';
import { Globe } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/i18n';

const options: Array<{ locale: Locale; label: 'he' | 'ar' }> = [
  { locale: 'he', label: 'he' },
  { locale: 'ar', label: 'ar' },
];

export function LanguageSwitcher({
  menuSide = 'end',
  buttonClassName = 'h-14',
  captionClassName = 'hidden xl:block',
}: {
  menuSide?: 'start' | 'end';
  buttonClassName?: string;
  captionClassName?: string;
}) {
  const { locale, setLocale, messages } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={messages.lang.switchLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={`group relative inline-flex min-w-11 flex-col items-center justify-center rounded-xl px-1.5 text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-[#f4f7fb] hover:text-brand-blue ${buttonClassName}`}
      >
        <Globe className="size-5" aria-hidden="true" />
        <span className={`mt-0.5 text-[10px] font-bold leading-none xl:text-[11px] xl:leading-4 ${captionClassName}`}>{messages.lang.caption}</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={messages.lang.switchLabel}
          className={`absolute top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_32px_rgb(23_32_51/0.12)] ${menuSide === 'start' ? 'start-0' : 'end-0'}`}
        >
          {options.map((option) => {
            const selected = locale === option.locale;
            return (
              <button
                key={option.locale}
                type="button"
                role="menuitemradio"
                lang={option.locale}
                aria-checked={selected}
                onClick={() => {
                  setLocale(option.locale);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2.5 text-start text-sm font-semibold ${selected ? 'text-brand-blue' : 'text-ink hover:bg-[#f7f8fa]'}`}
              >
                {messages.lang[option.label]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
