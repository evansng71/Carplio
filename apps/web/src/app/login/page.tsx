'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@horizon-demo.fr');
  const [password, setPassword] = useState('Demo-Autocar-OS-2026!');
  const [mfaCode, setMfaCode] = useState('');
  const [needMfa, setNeedMfa] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password, mfaCode || undefined);
      router.push('/app');
    } catch (err) {
      const e = err as Error & { mfaRequired?: boolean };
      if (e.mfaRequired) {
        setNeedMfa(true);
        setError('Saisissez le code MFA');
      } else {
        setError(e.message || 'Échec connexion');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 600px at 10% -10%, #1b6ca833, transparent), radial-gradient(900px 500px at 90% 10%, #0b1f3344, transparent), linear-gradient(160deg, #f7f5f1 0%, #e8eef4 55%, #d5e3f0 100%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-action">
            AUTOCAR OS
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-night">
            Connexion nominative
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Comptes DEMO Autocars Horizon — port {process.env.NEXT_PUBLIC_WEB_PORT || '3100'}.
          </p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label">Identifiant</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {needMfa && (
            <div>
              <label className="label">Code MFA</label>
              <input
                className="input"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="6 chiffres"
                autoComplete="one-time-code"
              />
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link className="font-semibold text-action" href="/conducteur">
            Portail conducteur
          </Link>
          {' · '}
          <Link className="font-semibold text-action" href="/client">
            Portail client
          </Link>
        </p>
      </div>
    </div>
  );
}
