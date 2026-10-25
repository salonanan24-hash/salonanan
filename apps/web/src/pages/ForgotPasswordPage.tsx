import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/auth-context';
import {
  AuthCard,
  AuthLabel,
  AuthNotice,
  AuthSubmit,
  AuthSwitch,
  authInputClass,
} from '@/components/auth/AuthFields';
import { useI18n } from '@/i18n';
import { messageFor } from './LoginPage';

export function ForgotPasswordPage() {
  const { messages } = useI18n();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setNotice(messages.auth.missing);
      return;
    }
    setPending(true);
    setNotice('');
    const result = await auth.requestPasswordReset(email.trim());
    setPending(false);
    if (result.error) {
      setNotice(messageFor(result.error, messages.auth));
      return;
    }
    setSent(true);
  }

  return (
    <AuthCard title={messages.auth.forgotTitle}>
      {sent ? (
        <AuthNotice tone="ok">{messages.auth.resetSent}</AuthNotice>
      ) : (
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
          {notice ? <AuthNotice>{notice}</AuthNotice> : null}
          <AuthSubmit pending={pending} label={messages.auth.submitForgot} />
        </form>
      )}
      <AuthSwitch prompt={messages.auth.hasAccount} to="/login" label={messages.auth.loginTitle} />
    </AuthCard>
  );
}
