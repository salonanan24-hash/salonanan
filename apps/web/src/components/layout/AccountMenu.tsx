import { isAdminEmail } from '@anan/shared';
import { UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { useI18n } from '@/i18n';

export function AccountMenu() {
  const { messages } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const copy = messages.account;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

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

  if (!auth.user) {
    return (
      <Link
        to="/login"
        aria-label={messages.header.account}
        className="group relative hidden h-14 min-w-11 flex-col items-center justify-center rounded-xl px-1.5 text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-[#f4f7fb] hover:text-brand-blue lg:flex"
      >
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <span className="mt-0.5 hidden text-[11px] font-bold leading-4 xl:block">{messages.header.account}</span>
      </Link>
    );
  }

  const admin = isAdminEmail(auth.user.email);

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="group relative flex h-14 min-w-11 flex-col items-center justify-center rounded-xl px-1.5 text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-[#f4f7fb] hover:text-brand-blue"
      >
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <span className="mt-0.5 hidden text-[11px] font-bold leading-4 xl:block">{messages.header.account}</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={copy.menuLabel}
          className="absolute end-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_32px_rgb(23_32_51/0.12)]"
        >
          <Link role="menuitem" to="/account" className="block px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#f7f8fa]">
            {copy.menuAccount}
          </Link>
          <Link role="menuitem" to="/account/orders" className="block px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#f7f8fa]">
            {copy.orders}
          </Link>
          {admin ? (
            <Link role="menuitem" to="/admin" className="block px-4 py-2.5 text-sm font-semibold text-ink hover:bg-[#f7f8fa]">
              {copy.adminLink}
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => void auth.signOut()}
            className="block w-full border-t border-line px-4 py-2.5 text-start text-sm font-semibold text-ink hover:bg-[#f7f8fa]"
          >
            {copy.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}
