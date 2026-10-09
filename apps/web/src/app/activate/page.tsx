'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function ActivateForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(sp.get('token') || '');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ email: string }>('/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setMsg(`Compte activé pour ${res.email}. Vous pouvez vous connecter.`);
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto mt-20 max-w-md space-y-3 p-6">
      <h1 className="text-xl font-bold">Activer mon accès</h1>
      <p className="text-sm text-[var(--muted)]">
        Choisissez votre mot de passe — jamais défini par un administrateur.
      </p>
      <div>
        <label className="label">Jeton d’invitation</label>
        <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
      </div>
      <div>
        <label className="label">Mot de passe (min 10)</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={10}
          required
        />
      </div>
      <button className="btn-primary w-full">Activer</button>
      {msg && <p className="text-sm text-action">{msg}</p>}
    </form>
  );
}

export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateForm />
    </Suspense>
  );
}
