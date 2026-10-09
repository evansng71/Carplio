'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PortalOpsPage() {
  const [data, setData] = useState<{
    drivers: unknown[];
    receipts: unknown[];
    threads: Array<{
      id: string;
      subject: string;
      status: string;
      messages: Array<{ body: string }>;
    }>;
    leaves: Array<{
      id: string;
      status: string;
      comment?: string;
      employee: { firstName: string; lastName: string };
    }>;
    incidents: Array<{ id: string; category: string; description: string }>;
  } | null>(null);
  const [preview, setPreview] = useState('');

  const load = () => api('/portal/ops/overview').then(setData);
  useEffect(() => {
    load();
  }, []);

  if (!data) return <p>Chargement centre portail…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Centre portail conducteurs</h1>
        <p className="text-sm text-[var(--muted)]">
          Accusés, messages, congés, incidents — vue exploitation.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Messages</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.threads.map((t) => (
              <li key={t.id} className="rounded-lg border border-[var(--border)] p-2">
                <div className="font-medium">
                  {t.subject} · {t.status}
                </div>
                <div className="text-[var(--muted)]">
                  {t.messages[0]?.body}
                </div>
                <button
                  className="btn-primary mt-2"
                  onClick={async () => {
                    await api(`/portal/ops/messages/${t.id}/reply`, {
                      method: 'POST',
                      body: JSON.stringify({
                        body: 'Bien reçu, véhicule A12 confirmé. (DEMO)',
                      }),
                    });
                    load();
                  }}
                >
                  Répondre
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Congés en attente</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.leaves.map((l) => (
              <li key={l.id} className="rounded-lg border border-[var(--border)] p-2">
                {l.employee.firstName} {l.employee.lastName} — {l.comment}
                <div className="mt-2 flex gap-2">
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      await api(`/leaves/${l.id}/decide`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'approved' }),
                      });
                      load();
                    }}
                  >
                    Approuver
                  </button>
                  <button
                    className="btn-danger"
                    onClick={async () => {
                      await api(`/leaves/${l.id}/decide`, {
                        method: 'POST',
                        body: JSON.stringify({
                          status: 'rejected',
                          decisionNote: 'Conflit planning',
                        }),
                      });
                      load();
                    }}
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
            {data.leaves.length === 0 && (
              <li className="text-[var(--muted)]">Aucune demande.</li>
            )}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Incidents</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.incidents.map((i) => (
              <li key={i.id}>
                <strong>{i.category}</strong> — {i.description}
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Voir comme conducteur</h2>
          <p className="text-xs text-[var(--muted)]">
            Prévisualisation lecture seule du planning publié (auditée).
          </p>
          <button
            className="btn-primary mt-3"
            onClick={async () => {
              const drivers = data.drivers as Array<{ id: string }>;
              if (!drivers[0]) return;
              const r = await api(`/portal/ops/as-driver/${drivers[0].id}`);
              setPreview(JSON.stringify(r, null, 2));
            }}
          >
            Prévisualiser 1er conducteur
          </button>
          {preview && (
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-night/5 p-2 text-[10px]">
              {preview}
            </pre>
          )}
        </section>
      </div>
      <section className="card p-4">
        <h2 className="font-semibold">Accusés « planning vu »</h2>
        <pre className="mt-2 max-h-40 overflow-auto text-xs">
          {JSON.stringify(data.receipts, null, 2)}
        </pre>
      </section>
    </div>
  );
}
