import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import {
  AuthCard,
  AuthLabel,
  AuthNotice,
  AuthSubmit,
  AuthSwitch,
  PasswordField,
  authInputClass,
} from '@/components/auth/AuthFields';
import { pushToast, registerWelcomePending } from '@/components/ui/ActionToast';
import { useI18n } from '@/i18n';

export function LoginPage() {
  const { messages } = useI18n();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  if (auth.ready && auth.user && !registerWelcomePending()) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setNotice(messages.auth.missing);
      return;
    }
    setPending(true);
    setNotice('');
    const result = await auth.signIn(email.trim(), password);
    setPending(false);
    if (result.error) {
      setNotice(messageFor(result.error, messages.auth));
      return;
    }
    sessionStorage.removeItem('anan-register-welcome');
    pushToast('login');
  }

  return (
    <AuthCard title={messages.auth.loginTitle}>
      <form onSubmit={onSubmit}>
        <AuthLabel label={messages.auth.email}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={authInputClass}
          />
        </AuthLabel>
        <PasswordField
          label={messages.auth.password}
          value={password}
          autoComplete="current-password"
          onChange={setPassword}
        />
        <Link to="/forgot-password" className="mt-3 inline-block text-sm text-ink">
          {messages.auth.forgot}
        </Link>
        {notice ? <AuthNotice>{notice}</AuthNotice> : null}
        <AuthSubmit pending={pending} label={messages.auth.submitLogin} />
      </form>
      <AuthSwitch
        prompt={messages.auth.noAccount}
        to="/register"
        label={messages.auth.registerTitle}
      />
    </AuthCard>
  );
}

export function messageFor(
  code: string,
  auth: {
    notConfigured: string;
    invalid: string;
    emailNotConfirmed: string;
    failed: string;
  },
): string {
  if (code === 'notConfigured') return auth.notConfigured;
  if (code === 'invalid') return auth.invalid;
  if (code === 'emailNotConfirmed') return auth.emailNotConfirmed;
  return auth.failed;
}
