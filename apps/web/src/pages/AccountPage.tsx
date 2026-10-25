import type { User } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/auth-context';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';

function textMeta(user: User, key: string): string {
  const value = user.user_metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function profileNames(user: User): { firstName: string; lastName: string } {
  const firstName = textMeta(user, 'first_name');
  const lastName = textMeta(user, 'last_name');
  if (firstName || lastName) return { firstName, lastName };
  const full = textMeta(user, 'full_name').trim();
  const space = full.indexOf(' ');
  if (space === -1) return { firstName: full, lastName: '' };
  return { firstName: full.slice(0, space), lastName: full.slice(space + 1).trim() };
}

const fieldClass =
  'h-12 w-full rounded-lg border border-[#e4e4e4] bg-white px-3 text-sm text-ink outline-none focus:border-ink disabled:bg-[#f3f3f3] disabled:text-muted';

export function AccountPage() {
  const { messages } = useI18n();
  const auth = useAuth();
  const copy = messages.account;
  const user = auth.user;
  const names = user ? profileNames(user) : { firstName: '', lastName: '' };
  const [firstName, setFirstName] = useState(names.firstName);
  const [lastName, setLastName] = useState(names.lastName);
  const [phone, setPhone] = useState(user ? textMeta(user, 'phone') : '');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  usePageTitle(copy.details);

  if (!user) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setSaved(false);
      setNotice(copy.missing);
      return;
    }
    setPending(true);
    setNotice('');
    setSaved(false);
    const result = await auth.updateProfile({ firstName, lastName, phone });
    setPending(false);
    if (result.error) {
      setNotice(result.error === 'notConfigured' ? messages.auth.notConfigured : copy.saveFailed);
      return;
    }
    setSaved(true);
  }

  return (
    <form className="mx-auto w-full max-w-xl" onSubmit={onSubmit}>
      <h1 className="text-3xl font-extrabold text-ink">{copy.details}</h1>
      <p className="mt-3 text-sm text-muted">{copy.requiredNote}</p>
      <h2 className="mt-8 text-lg font-bold text-ink">{copy.personal}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          {copy.firstName} *
          <input
            value={firstName}
            autoComplete="given-name"
            onChange={(event) => setFirstName(event.target.value)}
            className={`${fieldClass} mt-2 font-normal`}
            required
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {copy.lastName} *
          <input
            value={lastName}
            autoComplete="family-name"
            onChange={(event) => setLastName(event.target.value)}
            className={`${fieldClass} mt-2 font-normal`}
            required
          />
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-ink">
        {copy.email}
        <input value={user.email ?? ''} disabled className={`${fieldClass} mt-2 font-normal`} />
      </label>
      <label className="mt-4 block text-sm font-semibold text-ink">
        {copy.phone} *
        <input
          value={phone}
          autoComplete="tel"
          inputMode="tel"
          onChange={(event) => setPhone(event.target.value)}
          className={`${fieldClass} mt-2 font-normal`}
          required
        />
      </label>
      {notice ? <p className="mt-4 text-sm font-semibold text-brand-red">{notice}</p> : null}
      {saved ? <p className="mt-4 text-sm font-semibold text-ink">{copy.saved}</p> : null}
      <div className="mt-8 flex justify-center">
        <button
          type="submit"
          disabled={pending}
          className="h-11 min-w-28 rounded-md bg-ink px-6 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? copy.saving : copy.save}
        </button>
      </div>
    </form>
  );
}
