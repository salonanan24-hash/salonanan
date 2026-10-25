import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getBrowserSupabase, isSupabaseBrowserConfigured } from '@/lib/supabase';

type AuthResult = { error?: string; needsConfirmation?: boolean };

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    locale: 'he' | 'ar';
  }) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  updateProfile: (input: { firstName: string; lastName: string; phone: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapError(message: string): string {
  const folded = message.toLowerCase();
  if (folded.includes('invalid login credentials')) return 'invalid';
  if (folded.includes('email not confirmed')) return 'emailNotConfirmed';
  return 'failed';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseBrowserConfigured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const client = getBrowserSupabase();
    if (!client) return;

    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      ready,
      configured: isSupabaseBrowserConfigured,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        const client = getBrowserSupabase();
        if (!client) return { error: 'notConfigured' };
        const { error } = await client.auth.signInWithPassword({ email, password });
        return error ? { error: mapError(error.message) } : {};
      },
      async signUp(input) {
        const client = getBrowserSupabase();
        if (!client) return { error: 'notConfigured' };
        const name = input.fullName.trim();
        const space = name.indexOf(' ');
        const { data, error } = await client.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: {
              full_name: name,
              first_name: space === -1 ? name : name.slice(0, space),
              last_name: space === -1 ? '' : name.slice(space + 1).trim(),
              phone: input.phone,
              preferred_locale: input.locale,
            },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) return { error: mapError(error.message) };
        if (data.session) await client.auth.signOut();
        return {};
      },
      async requestPasswordReset(email) {
        const client = getBrowserSupabase();
        if (!client) return { error: 'notConfigured' };
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return error ? { error: 'failed' } : {};
      },
      async updatePassword(password) {
        const client = getBrowserSupabase();
        if (!client) return { error: 'notConfigured' };
        const { error } = await client.auth.updateUser({ password });
        return error ? { error: 'failed' } : {};
      },
      async updateProfile(input) {
        const client = getBrowserSupabase();
        if (!client) return { error: 'notConfigured' };
        const firstName = input.firstName.trim();
        const lastName = input.lastName.trim();
        const { error } = await client.auth.updateUser({
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            phone: input.phone.trim(),
          },
        });
        return error ? { error: 'failed' } : {};
      },
      async signOut() {
        const client = getBrowserSupabase();
        if (!client) return;
        await client.auth.signOut();
      },
    };
  }, [ready, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
