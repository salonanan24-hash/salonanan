import { Check, Eye, EyeOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { passwordChecks, passwordIsStrong } from '@/auth/password';
import { useI18n } from '@/i18n';
import { usePageTitle } from '@/hooks/use-page-title';
import { Container } from '@/components/ui/Container';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title);
  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-ink">{title}</h1>
        <div className="mt-8">{children}</div>
      </div>
    </Container>
  );
}

export function AuthLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="mb-2 block text-sm text-ink">{label}</span>
      {children}
    </label>
  );
}

export const authInputClass =
  'h-12 w-full rounded-lg border border-line bg-white px-4 text-sm text-ink outline-none focus:border-brand-blue';

export function PasswordField({
  label,
  value,
  autoComplete,
  onChange,
  hint = false,
}: {
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
  hint?: boolean;
}) {
  const { messages } = useI18n();
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const checks = passwordChecks(value);
  const rules = [
    { ok: checks.length, label: messages.auth.passwordLength },
    { ok: checks.upper, label: messages.auth.passwordUpper },
    { ok: checks.digit, label: messages.auth.passwordDigit },
  ];
  const showRules = hint && !passwordIsStrong(value) && (helpOpen || value.length > 0);

  return (
    <div className="mt-5">
      <span className="mb-2 flex items-center gap-2 text-sm text-ink">
        {label}
        {hint && !passwordIsStrong(value) ? (
          <button
            type="button"
            aria-label={messages.auth.passwordHelp}
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((current) => !current)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs font-bold text-muted"
          >
            ?
          </button>
        ) : null}
      </span>
      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`${authInputClass} pe-12`}
        />
        <button
          type="button"
          aria-label={visible ? messages.auth.hidePassword : messages.auth.showPassword}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
      {showRules ? (
        <ul className="mt-2 space-y-1.5 rounded-lg bg-[#f6f8fb] px-3 py-2.5">
          {rules.map((rule) => {
            const pending = value.length > 0 && !rule.ok;
            return (
              <li key={rule.label} className={`flex items-center gap-2 text-xs ${pending ? 'text-brand-red' : 'text-muted'}`}>
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    rule.ok ? 'border-brand-blue bg-brand-blue text-white' : pending ? 'border-brand-red' : 'border-line bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {rule.ok ? <Check className="h-3 w-3" /> : null}
                </span>
                {rule.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function AuthSubmit({ pending, label }: { pending: boolean; label: string }) {
  const { messages } = useI18n();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-8 flex h-12 w-full items-center justify-center rounded-lg bg-brand-red text-sm font-bold text-white hover:bg-[#c81f22] disabled:opacity-60"
    >
      {pending ? messages.auth.working : label}
    </button>
  );
}

export function AuthSwitch({
  prompt,
  to,
  label,
}: {
  prompt: string;
  to: string;
  label: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-ink">
      {prompt}{' '}
      <Link to={to} className="font-bold text-brand-red">
        {label}
      </Link>
    </p>
  );
}

export function AuthNotice({ children, tone = 'error' }: { children: string; tone?: 'error' | 'ok' }) {
  return (
    <p role="status" className={`mt-4 text-sm leading-6 ${tone === 'ok' ? 'text-ink' : 'text-brand-red'}`}>
      {children}
    </p>
  );
}
