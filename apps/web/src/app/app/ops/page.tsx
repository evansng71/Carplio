'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  IconBan,
  IconBus,
  IconCalendar,
  IconRoute,
  IconSteering,
  IconTile,
} from '@/components/Icons';
import {
  formatDateTime,
  missionStatusTone,
  MISSION_STATUS,
} from '@/lib/ops';

type Overview = {
  date: string;
  kpis: {
    missionsToday: number;
    toPlan: number;
    published: number;
    inProgress: number;
    unassigned: number;
    assignmentsToday: number;
    driversActive: number;
    vehiclesAvailable: number;
    conflictCount: number;
    complianceCritical: number;
  };
  complianceAlerts: Array<{
    kind: string;
    severity: string;
    label: string;
    resourceType: string;
    resourceId: string;
    daysLeft?: number | null;
  }>;
  upcoming: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    startsAt: string;
    origin?: string | null;
    destination?: string | null;
    passengers: number;
    order: { customer: { name: string } };
    assignments: Array<{
      driver?: { employee: { firstName: string; lastName: string } } | null;
      vehicle?: { fleetNumber: string; plate: string } | null;
    }>;
  }>;
};

export default function OpsHubPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Overview>(`/ops/overview?date=${date}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function autoAssign(dryRun: boolean) {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await api<{
        assigned: number;
        failed: number;
        total: number;
        results: Array<{ missionNumber: string; ok: boolean; reason: string }>;
      }>('/ops/auto-assign', {
        method: 'POST',
        body: JSON.stringify({ date, dryRun }),
      });
      setMsg(
        dryRun
          ? `Simulation : ${r.assigned}/${r.total} missions pourraient être affectées`
          : `${r.assigned} mission(s) affectée(s), ${r.failed} en échec`,
      );
      if (!dryRun) load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const k = data?.kpis;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="violet">
            <IconRoute />
          </IconTile>
          <div>
            <p className="page-kicker">Module exploitation</p>
            <h1 className="text-2xl font-bold">Cockpit exploitation</h1>
            <p className="text-sm text-[var(--muted)]">
              Planning, flotte, conducteurs et missions — vue opérationnelle du
              jour.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Jour</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => autoAssign(true)}
          >
            Simuler auto-affectation
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => autoAssign(false)}
          >
            Affecter automatiquement
          </button>
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Missions du jour',
            value: k?.missionsToday ?? '—',
            href: '/app/missions',
          },
          {
            label: 'Non affectées (7 j)',
            value: k?.unassigned ?? '—',
            href: '/app/planning',
          },
          {
            label: 'À planifier',
            value: k?.toPlan ?? '—',
            href: '/app/missions',
          },
          {
            label: 'Conflits planning',
            value: k?.conflictCount ?? '—',
            href: '/app/planning',
          },
          {
            label: 'Publiées aujourd’hui',
            value: k?.published ?? '—',
            href: '/app/planning',
          },
          {
            label: 'Conducteurs actifs',
            value: k?.driversActive ?? '—',
            href: '/app/drivers',
          },
          {
            label: 'Véhicules dispo',
            value: k?.vehiclesAvailable ?? '—',
            href: '/app/vehicles',
          },
          {
            label: 'Alertes conformité',
            value: k?.complianceCritical ?? '—',
            href: '/app/ops',
          },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="card p-4 hover:border-action/40">
            <p className="text-xs text-[var(--muted)]">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          {
            href: '/app/planning',
            label: 'Planning',
            desc: 'Tableau de répartition',
            icon: <IconCalendar />,
            tone: 'blue' as const,
          },
          {
            href: '/app/missions',
            label: 'Missions',
            desc: 'Feuilles de route',
            icon: <IconRoute />,
            tone: 'violet' as const,
          },
          {
            href: '/app/vehicles',
            label: 'Flotte',
            desc: 'Parc & conformité',
            icon: <IconBus />,
            tone: 'teal' as const,
          },
          {
            href: '/app/drivers',
            label: 'Conducteurs',
            desc: 'Habilitations',
            icon: <IconSteering />,
            tone: 'emerald' as const,
          },
          {
            href: '/app/unavailabilities',
            label: 'Indisponibilités',
            desc: 'Absences & garage',
            icon: <IconBan />,
            tone: 'rose' as const,
          },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card flex items-center gap-3 p-4 hover:border-action/40"
          >
            <IconTile tone={l.tone}>{l.icon}</IconTile>
            <div>
              <div className="font-semibold">{l.label}</div>
              <div className="text-xs text-[var(--muted)]">{l.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Missions à venir (7 jours)
          </div>
          <div className="divide-y divide-[var(--border)]">
            {(data?.upcoming || []).map((m) => {
              const a = m.assignments[0];
              return (
                <Link
                  key={m.id}
                  href={`/app/missions/${m.id}`}
                  className="block px-4 py-3 hover:bg-[var(--surface-2)]/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{m.number}</span>
                      <span className="text-[var(--muted)]"> — {m.title}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${missionStatusTone(m.status)}`}
                    >
                      {MISSION_STATUS[m.status] || m.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {formatDateTime(m.startsAt)} · {m.order.customer.name} ·{' '}
                    {m.origin} → {m.destination} · {m.passengers} pax
                  </div>
                  <div className="mt-1 text-xs">
                    {a?.driver
                      ? `${a.driver.employee.firstName} ${a.driver.employee.lastName}`
                      : 'Sans conducteur'}
                    {' · '}
                    {a?.vehicle
                      ? `${a.vehicle.fleetNumber} (${a.vehicle.plate})`
                      : 'Sans véhicule'}
                  </div>
                </Link>
              );
            })}
            {data && data.upcoming.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                Aucune mission sur les 7 prochains jours.
              </p>
            )}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Alertes conformité (CT, permis, FCO…)
          </div>
          <div className="divide-y divide-[var(--border)]">
            {(data?.complianceAlerts || []).map((a, i) => (
              <Link
                key={`${a.resourceId}-${i}`}
                href={
                  a.resourceType === 'driver'
                    ? `/app/drivers/${a.resourceId}`
                    : `/app/vehicles/${a.resourceId}`
                }
                className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-2)]/50"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    a.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                />
                <div>
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {a.resourceType === 'driver' ? 'Conducteur' : 'Véhicule'}
                    {a.daysLeft != null
                      ? ` · ${a.daysLeft < 0 ? 'expiré' : `${a.daysLeft} j restants`}`
                      : ''}
                  </div>
                </div>
              </Link>
            ))}
            {data && data.complianceAlerts.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                Aucune échéance critique dans les 30 jours.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
