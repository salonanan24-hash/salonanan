import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/auth-context';
import { passwordIsStrong } from '@/auth/password';
import { markRegisterWelcome, registerWelcomePending } from '@/components/ui/ActionToast';
import {
  AuthCard,
  AuthLabel,
  AuthNotice,
  AuthSubmit,
  AuthSwitch,
  PasswordField,
  authInputClass,
} from '@/components/auth/AuthFields';
import { useI18n } from '@/i18n';
import { apiBase } from '@/lib/api-url';
import { messageFor } from './LoginPage';

export function RegisterPage() {
  const { locale, messages } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const holdAccount = useRef(false);

  if (auth.ready && auth.user && !holdAccount.current && !registerWelcomePending()) {
    return <Navigate to="/account" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password || !confirm) {
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
    holdAccount.current = true;
    const result = await auth.signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      locale,
    });
    setPending(false);
    if (result.error) {
      holdAccount.current = false;
      setNotice(messageFor(result.error, messages.auth));
      return;
    }
    try {
      await fetch(`${apiBase()}/api/account/welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // The account already exists. A missing welcome mail should not block sign-in.
    }
    markRegisterWelcome();
    navigate('/login');
  }

  return (
    <AuthCard title={messages.auth.registerTitle}>
      <form onSubmit={onSubmit}>
          <AuthLabel label={messages.auth.fullName}>
            <input
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={authInputClass}
            />
          </AuthLabel>
          <AuthLabel label={messages.auth.email}>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInputClass}
            />
          </AuthLabel>
          <AuthLabel label={messages.auth.phone}>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={authInputClass}
            />
          </AuthLabel>
          <PasswordField
            label={messages.auth.password}
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
          <AuthSubmit pending={pending} label={messages.auth.submitRegister} />
        </form>
      <AuthSwitch prompt={messages.auth.hasAccount} to="/login" label={messages.auth.loginTitle} />
    </AuthCard>
  );
}
