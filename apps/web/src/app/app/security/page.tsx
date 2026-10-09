'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function SecurityMfaPage() {
  const [setup, setSetup] = useState<{ secret: string; demoCode: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold">MFA / Sécurité compte</h1>
        <p className="text-sm text-[var(--muted)]">
          Authentification à deux facteurs (TOTP). Obligatoire pour les rôles sensibles en prod.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}
      <div className="card space-y-3 p-4">
        <button
          className="btn-primary w-full"
          onClick={async () => {
            const r = await api<{ secret: string; demoCode: string }>('/auth/mfa/setup', {
              method: 'POST',
              body: '{}',
            });
            setSetup(r);
            setCode(r.demoCode);
            setMsg('Secret généré — validez avec le code');
          }}
        >
          Configurer MFA
        </button>
        {setup && (
          <>
            <p className="text-xs break-all">Secret: {setup.secret}</p>
            <p className="text-xs">Code démo courant: {setup.demoCode}</p>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code 6 chiffres" />
            <button
              className="btn-primary w-full"
              onClick={async () => {
                await api('/auth/mfa/enable', {
                  method: 'POST',
                  body: JSON.stringify({ code }),
                });
                setMsg('MFA activé — requis à la prochaine connexion');
              }}
            >
              Activer MFA
            </button>
          </>
        )}
        <button
          className="btn-danger w-full"
          onClick={async () => {
            await api('/auth/mfa/disable', { method: 'POST', body: '{}' });
            setMsg('MFA désactivé');
            setSetup(null);
          }}
        >
          Désactiver MFA
        </button>
      </div>
    </div>
  );
}
