import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { passwordIsStrong } from '@/auth/password';
import { clearPasswordReset, readPasswordReset, resetPassword } from '@/auth/password-reset';
import {
  AuthCard,
  AuthNotice,
  AuthSubmit,
  PasswordField,
} from '@/components/auth/AuthFields';
import { useI18n } from '@/i18n';

export function ResetPasswordPage() {
  const { messages } = useI18n();
  const grant = readPasswordReset();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grant) return;
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
    try {
      await resetPassword(grant.email, grant.token, password);
      clearPasswordReset();
      setDone(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setNotice(code === 'password' ? messages.auth.passwordShort : code === 'invalid_code' ? messages.auth.codeInvalid : messages.auth.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title={messages.auth.resetTitle}>
      {done ? (
        <>
          <AuthNotice tone="ok">{messages.auth.resetDone}</AuthNotice>
          <Link to="/login" className="mt-6 inline-block text-sm font-bold text-brand-red">
            {messages.auth.loginTitle}
          </Link>
        </>
      ) : !grant ? (
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
