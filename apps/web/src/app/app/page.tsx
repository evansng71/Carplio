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
  IconMail,
  IconRoute,
  IconSteering,
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
    body?: string | null;
    href?: string | null;
  }>;
  messages: Array<{
    id: string;
    subject: string;
    status: string;
    threadType: string;
    counterpart: string;
    preview: string;
    authorName?: string | null;
    at: string;
    unanswered: boolean;
  }>;
  dayOpen: Record<string, number>;
};

const KPI: Array<{
  key: string;
  label: string;
  href: string;
  tone: Tone;
  Icon: typeof IconRoute;
  hint: string;
  hot?: boolean;
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
    hot: true,
  },
  {
    key: 'messagesUnanswered',
    label: 'Messages à traiter',
    href: '/app/messaging?status=new',
    tone: 'cyan',
    Icon: IconMail,
    hint: 'Portail / messagerie',
    hot: true,
  },
  {
    key: 'leavesPending',
    label: 'Congés à valider',
    href: '/app/hr/leaves',
    tone: 'teal',
    Icon: IconCalendar,
    hint: 'RH',
    hot: true,
  },
  {
    key: 'incidentsOpen',
    label: 'Incidents ouverts',
    href: '/app/quality',
    tone: 'rose',
    Icon: IconAlert,
    hint: 'Qualité',
    hot: true,
  },
  {
    key: 'vehiclesImmobilized',
    label: 'Véhicules immobilisés',
    href: '/app/vehicles',
    tone: 'orange',
    Icon: IconBus,
    hint: 'Flotte',
    hot: true,
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
    key: 'ticketReturnsPending',
    label: 'Retours billets',
    href: '/app/portal-ops',
    tone: 'cyan',
    Icon: IconUsers,
    hint: 'Exploitation',
  },
  {
    key: 'serviceEventsToday',
    label: 'Prises de service',
    href: '/app/portal-ops',
    tone: 'emerald',
    Icon: IconSteering,
    hint: 'Portail aujourd’hui',
  },
  {
    key: 'driversActive',
    label: 'Conducteurs actifs',
    href: '/app/drivers',
    tone: 'blue',
    Icon: IconSteering,
    hint: 'Effectif ops',
  },
];

function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
    return <p className="text-[var(--muted)]">Chargement du tableau de bord…</p>;

  const unanswered = data.messages.filter((m) => m.unanswered);
  const recent = data.messages;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Vue d’ensemble</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Indicateurs clés, messagerie et alertes pour piloter la journée.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/messaging" className="btn-secondary inline-flex items-center gap-2">
            <IconMail size={16} />
            Messagerie
            {(data.widgets.messagesUnanswered || 0) > 0 && (
              <span className="badge-danger">
                {data.widgets.messagesUnanswered}
              </span>
            )}
          </Link>
          <Link href="/app/planning" className="btn-primary inline-flex items-center gap-2">
            <IconCalendar size={16} />
            Planning
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {KPI.map((c) => {
          const value = data.widgets[c.key] ?? 0;
          const hot = !!c.hot && value > 0;
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card flex min-h-0 flex-col p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IconTile tone="cyan" className="h-9 w-9">
                <IconMail size={16} />
              </IconTile>
              <div>
                <h2 className="font-semibold">Messagerie</h2>
                <p className="text-xs text-[var(--muted)]">
                  {unanswered.length
                    ? `${unanswered.length} à traiter en priorité`
                    : 'Derniers échanges'}
                </p>
              </div>
            </div>
            <Link
              href="/app/messaging"
              className="text-xs font-semibold text-[var(--accent)]"
            >
              Tout voir →
            </Link>
          </div>
          <ul className="space-y-2">
            {recent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/app/messaging?thread=${m.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2.5 text-sm transition hover:border-[var(--accent)]/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {m.unanswered && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                      )}
                      <span className="truncate font-medium">{m.subject}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                      {m.counterpart}
                      {' · '}
                      {m.threadType === 'driver' ? 'Portail' : 'Interne'}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                      {m.preview || '—'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-[var(--muted)]">
                      {formatWhen(m.at)}
                    </div>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        m.unanswered
                          ? 'bg-amber-100 text-amber-800'
                          : m.status === 'closed'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {m.unanswered ? 'à traiter' : m.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
            {!recent.length && (
              <li className="rounded-xl bg-ok/5 px-3 py-3 text-sm text-ok">
                Aucun message pour le moment.
              </li>
            )}
          </ul>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <IconTile tone="amber" className="h-9 w-9">
              <IconAlert size={16} />
            </IconTile>
            <div>
              <h2 className="font-semibold">Alertes prioritaires</h2>
              <p className="text-xs text-[var(--muted)]">
                Portail, flotte, RH et qualité
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {data.alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/60 px-3 py-2.5 text-sm"
              >
                <div className="flex min-w-0 gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      a.severity === 'critical' || a.severity === 'warning'
                        ? 'bg-warn/15 text-warn'
                        : 'bg-action/10 text-action'
                    }`}
                  >
                    <IconAlert size={15} />
                  </span>
                  <div className="min-w-0">
                    {a.href ? (
                      <Link
                        href={a.href}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {a.title}
                      </Link>
                    ) : (
                      <div className="font-medium">{a.title}</div>
                    )}
                    {a.body && (
                      <div className="line-clamp-2 text-[var(--muted)]">
                        {a.body}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={
                    a.severity === 'critical' || a.severity === 'warning'
                      ? 'badge-warn'
                      : 'badge-blue'
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
    </div>
  );
}
