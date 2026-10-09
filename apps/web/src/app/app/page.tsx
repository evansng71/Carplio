'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type Dash = {
  widgets: Record<string, number>;
  alerts: Array<{ id: string; severity: string; title: string; body?: string; href?: string }>;
  dayOpen: Record<string, number>;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Dash>('/dashboard')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-danger">{err}</p>;
  if (!data) return <p className="text-[var(--muted)]">Chargement cockpit…</p>;

  const cards = [
    { key: 'missionsToday', label: 'Prestations du jour', href: '/app/missions' },
    { key: 'uncovered', label: 'Services non couverts', href: '/app/planning' },
    { key: 'quotesOpen', label: 'Devis à relancer', href: '/app/quotes' },
    { key: 'vehiclesImmobilized', label: 'Véhicules immobilisés', href: '/app/vehicles' },
    { key: 'leavesPending', label: 'Congés à valider', href: '/app/portal-ops' },
    { key: 'incidentsOpen', label: 'Incidents ouverts', href: '/app/portal-ops' },
    { key: 'ticketReturnsPending', label: 'Retours billet manquants', href: '/app/missions' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cockpit exploitation</h1>
        <p className="text-sm text-[var(--muted)]">
          Widgets branchés sur la base DEMO — ouverture de journée.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="card p-4 hover:border-action/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {c.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-night dark:text-cream">
              {data.widgets[c.key] ?? 0}
            </div>
          </Link>
        ))}
      </div>
      <section className="card p-5">
        <h2 className="font-semibold">Alertes prioritaires</h2>
        <ul className="mt-3 space-y-2">
          {data.alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{a.title}</div>
                {a.body && <div className="text-[var(--muted)]">{a.body}</div>}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  a.severity === 'warning'
                    ? 'bg-warn/15 text-warn'
                    : 'bg-action/10 text-action'
                }`}
              >
                {a.severity}
              </span>
            </li>
          ))}
          {data.alerts.length === 0 && (
            <li className="text-sm text-[var(--muted)]">Aucune alerte ouverte.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
