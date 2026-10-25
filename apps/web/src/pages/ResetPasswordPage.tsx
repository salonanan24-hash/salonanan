import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { passwordIsStrong } from '@/auth/password';
import {
  AuthCard,
  AuthNotice,
  AuthSubmit,
  PasswordField,
} from '@/components/auth/AuthFields';
import { useI18n } from '@/i18n';
import { messageFor } from './LoginPage';

export function ResetPasswordPage() {
  const { messages } = useI18n();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || !confirm) {
      setNotice(messages.auth.missing);
      return;
    }
    if (!passwordIsStrong(password)) {
      setNotice(messages.auth.passwordShort);
      return;
    }
    if (password !== confirm) {
      setNotice(messages.auth.passwordMismatch);
      return;
    }
    setPending(true);
    setNotice('');
    const result = await auth.updatePassword(password);
    setPending(false);
    if (result.error) {
      setNotice(messageFor(result.error, messages.auth));
      return;
    }
    setDone(true);
  }

  return (
    <AuthCard title={messages.auth.resetTitle}>
      {!auth.ready ? null : done ? (
        <>
          <AuthNotice tone="ok">{messages.auth.resetDone}</AuthNotice>
          <Link to="/account" className="mt-6 inline-block text-sm font-bold text-brand-red">
            {messages.account.title}
          </Link>
        </>
      ) : !auth.user ? (
        <AuthNotice>{messages.auth.resetMissing}</AuthNotice>
      ) : (
        <form onSubmit={onSubmit}>
          <PasswordField
            label={messages.auth.newPassword}
            value={password}
            autoComplete="new-password"
            onChange={setPassword}
            hint
          />
          <PasswordField
            label={messages.auth.confirmPassword}
            value={confirm}
            autoComplete="new-password"
            onChange={setConfirm}
          />
          {notice ? <AuthNotice>{notice}</AuthNotice> : null}
          <AuthSubmit pending={pending} label={messages.auth.submitReset} />
        </form>
      )}
    </AuthCard>
  );
}
