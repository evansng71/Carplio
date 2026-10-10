'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function ClientRequestsPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      contactName: string;
      email: string;
      origin?: string;
      destination?: string;
      status: string;
      passengers: number;
    }>
  >([]);
  const [msg, setMsg] = useState('');

  const load = () => api('/client-requests').then(setRows);
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Demandes portail client</h1>
        <p className="text-sm text-[var(--muted)]">
          Demandes publiques et espace client connecté — conversion en devis.
        </p>
        <p className="text-sm text-[var(--muted)]">
          Entrées publiques → conversion en devis.{' '}
          <Link className="text-action" href="/client" target="_blank">
            Ouvrir portail public
          </Link>
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <div className="font-semibold">
                {r.contactName} — {r.origin} → {r.destination}
              </div>
              <div className="text-[var(--muted)]">
                {r.email} · {r.passengers} pax · {r.status}
              </div>
            </div>
            {r.status === 'new' && (
              <button
                className="btn-primary"
                onClick={async () => {
                  const res = await api<{ quote: { number: string } }>(
                    `/client-requests/${r.id}/convert`,
                    { method: 'POST', body: '{}' },
                  );
                  setMsg(`Devis ${res.quote.number} créé`);
                  load();
                }}
              >
                Convertir en devis
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-[var(--muted)]">Aucune demande — testez /client</p>
        )}
      </div>
    </div>
  );
}
