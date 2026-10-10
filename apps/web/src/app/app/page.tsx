'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  IconAlert,
  IconBan,
  IconBus,
  IconCalendar,
  IconFile,
  IconRoute,
  IconTile,
  IconUsers,
  Tone,
} from '@/components/Icons';

type Dash = {
  widgets: Record<string, number>;
  alerts: Array<{
    id: string;
    severity: string;
    title: string;
    body?: string;
    href?: string;
  }>;
  dayOpen: Record<string, number>;
};

const CARDS: Array<{
  key: string;
  label: string;
  href: string;
  tone: Tone;
  Icon: typeof IconRoute;
  hint: string;
}> = [
  {
    key: 'missionsToday',
    label: 'Prestations du jour',
    href: '/app/missions',
    tone: 'violet',
    Icon: IconRoute,
    hint: 'Missions planifiées',
  },
  {
    key: 'uncovered',
    label: 'Services non couverts',
    href: '/app/planning',
    tone: 'rose',
    Icon: IconBan,
    hint: 'À affecter',
  },
  {
    key: 'quotesOpen',
    label: 'Devis à relancer',
    href: '/app/quotes',
    tone: 'amber',
    Icon: IconFile,
    hint: 'Commercial',
  },
  {
    key: 'vehiclesImmobilized',
    label: 'Véhicules immobilisés',
    href: '/app/vehicles',
    tone: 'orange',
    Icon: IconBus,
    hint: 'Flotte',
  },
  {
    key: 'leavesPending',
    label: 'Congés à valider',
    href: '/app/portal-ops',
    tone: 'teal',
    Icon: IconCalendar,
    hint: 'RH',
  },
  {
    key: 'incidentsOpen',
    label: 'Incidents ouverts',
    href: '/app/quality',
    tone: 'rose',
    Icon: IconAlert,
    hint: 'Qualité',
  },
  {
    key: 'ticketReturnsPending',
    label: 'Retours billet manquants',
    href: '/app/missions',
    tone: 'cyan',
    Icon: IconUsers,
    hint: 'Exploitation',
  },
];

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Dash>('/dashboard')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-danger">{err}</p>;
  if (!data)
    return <p className="text-[var(--muted)]">Chargement cockpit…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Ouverture de journée</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Cockpit exploitation
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Vue prioritaire branchée sur la base DEMO.
          </p>
        </div>
        <Link href="/app/planning" className="btn-primary">
          <IconCalendar size={16} />
          Ouvrir le planning
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => {
          const value = data.widgets[c.key] ?? 0;
          const hot = value > 0 && (c.key === 'uncovered' || c.key === 'incidentsOpen' || c.key === 'vehiclesImmobilized');
          return (
            <Link key={c.key} href={c.href} className="card-interactive p-4">
              <div className="flex items-start justify-between gap-3">
                <IconTile tone={c.tone}>
                  <c.Icon size={18} />
                </IconTile>
                {hot && <span className="badge-danger">Attention</span>}
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {c.label}
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-3xl font-bold text-night">{value}</div>
                <div className="pb-1 text-[11px] text-[var(--muted)]">{c.hint}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <IconTile tone="amber" className="h-9 w-9">
            <IconAlert size={16} />
          </IconTile>
          <div>
            <h2 className="font-semibold">Alertes prioritaires</h2>
            <p className="text-xs text-[var(--muted)]">
              Signaux à traiter en ouverture de journée
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {data.alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2.5 text-sm"
            >
              <div className="flex gap-3">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    a.severity === 'warning'
                      ? 'bg-warn/15 text-warn'
                      : 'bg-action/10 text-action'
                  }`}
                >
                  <IconAlert size={15} />
                </span>
                <div>
                  <div className="font-medium">{a.title}</div>
                  {a.body && (
                    <div className="text-[var(--muted)]">{a.body}</div>
                  )}
                </div>
              </div>
              <span
                className={
                  a.severity === 'warning' ? 'badge-warn' : 'badge-blue'
                }
              >
                {a.severity}
              </span>
            </li>
          ))}
          {data.alerts.length === 0 && (
            <li className="rounded-xl bg-ok/5 px-3 py-3 text-sm text-ok">
              Aucune alerte ouverte — bonne journée.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
