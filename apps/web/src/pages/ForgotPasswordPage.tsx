import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AuthCard,
  AuthLabel,
  AuthNotice,
  AuthSubmit,
  AuthSwitch,
  authInputClass,
} from '@/components/auth/AuthFields';
import { requestPasswordCode, savePasswordReset, verifyPasswordCode } from '@/auth/password-reset';
import { useI18n } from '@/i18n';

export function ForgotPasswordPage() {
  const { locale, messages } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setNotice(messages.auth.missing);
      return;
    }
    setPending(true);
    setNotice('');
    try {
      await requestPasswordCode(email.trim(), locale);
      setStep('code');
    } catch {
      setNotice(messages.auth.failed);
    } finally {
      setPending(false);
    }
  }

  async function checkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setNotice(messages.auth.codeInvalid);
      return;
    }
    setPending(true);
    setNotice('');
    try {
      const result = await verifyPasswordCode(email.trim(), code);
      savePasswordReset({ email: email.trim(), token: result.token });
      navigate('/reset-password');
    } catch (error) {
      setNotice(error instanceof Error && error.message === 'invalid_code' ? messages.auth.codeInvalid : messages.auth.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title={messages.auth.forgotTitle}>
      {step === 'email' ? (
        <form onSubmit={sendCode}>
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
      ) : (
        <form onSubmit={checkCode}>
          <AuthNotice tone="ok">{messages.auth.resetSent}</AuthNotice>
          <AuthLabel label={messages.auth.codeLabel}>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${authInputClass} text-center text-lg tracking-[0.4em]`}
            />
          </AuthLabel>
          {notice ? <AuthNotice>{notice}</AuthNotice> : null}
          <AuthSubmit pending={pending} label={messages.auth.submitCode} />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setStep('email');
              setCode('');
              setNotice('');
            }}
            className="mt-4 block text-sm font-semibold text-brand-blue"
          >
            {messages.auth.changeEmail}
          </button>
        </form>
      )}
      <AuthSwitch prompt={messages.auth.hasAccount} to="/login" label={messages.auth.loginTitle} />
    </AuthCard>
  );
}
