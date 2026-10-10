'use client';

import '../driver.css';
import { FormEvent, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { DriverNav } from './DriverNav';

export function DriverShell({ children }: { children: React.ReactNode }) {
  const { me, loading, login } = useAuth();
  const path = usePathname();
  const [email, setEmail] = useState('conducteur@horizon-demo.fr');
  const [password, setPassword] = useState('Demo-Autocar-OS-2026!');
  const [err, setErr] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!me) return;
    api<{ unreadMessages?: number }>('/portal/me/today')
      .then((t) => setUnread(t.unreadMessages || 0))
      .catch(() => setUnread(0));
  }, [me, path]);

  if (loading) {
    return (
      <div className="drv flex items-center justify-center p-8 text-sm text-[var(--drv-muted)]">
        Chargement…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="drv mx-auto min-h-dvh max-w-lg">
        <div className="drv-red-head px-5 pb-10 pt-12">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
            AUTOCAR OS
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Espace conducteur
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Planning, absences, messages et documents — optimisé smartphone.
          </p>
        </div>
        <form
          className="drv-card -mt-5 mx-4 space-y-3 p-5"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            setErr('');
            try {
              await login(email, password);
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : 'Échec connexion');
            }
          }}
        >
          <label className="block text-xs font-semibold text-[var(--drv-muted)]">
            Identifiant
            <input
              className="drv-input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--drv-muted)]">
            Mot de passe
            <input
              className="drv-input mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button type="submit" className="drv-btn-black">
            Connexion
          </button>
          <p className="text-center text-[11px] text-[var(--drv-muted)]">
            N’utilisez pas le téléphone en conduisant.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="drv mx-auto min-h-dvh max-w-lg">
      <div className="drv-main">{children}</div>
      <DriverNav unread={unread} />
    </div>
  );
}
