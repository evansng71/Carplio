'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type Mode = 'day' | 'week' | 'fortnight';

type Board = {
  mode: Mode;
  from: string;
  to: string;
  days: number;
  drivers: Array<{ id: string; employee: { firstName: string; lastName: string } }>;
  vehicles: Array<{ id: string; fleetNumber: string; plate: string; status: string }>;
  assignments: Array<{
    id: string;
    driverId?: string;
    vehicleId?: string;
    startsAt: string;
    endsAt: string;
    published: boolean;
    mission: { id: string; number: string; title: string };
    vehicle?: { fleetNumber: string };
  }>;
  rests: Array<{ id: string; driverId: string; startsAt: string; endsAt: string; kind: string }>;
  driverUnavs: Array<{
    id: string;
    driverId: string;
    startsAt: string;
    endsAt: string;
    kind: string;
    reason?: string;
  }>;
  orphans: Array<{ id: string; number: string; title: string; startsAt: string; endsAt: string }>;
  conflicts: Array<{ type: string; a?: string; b?: string; assignmentId?: string }>;
};

const DAY_MS = 86400000;

export default function PlanningPage() {
  const [mode, setMode] = useState<Mode>('fortnight');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [data, setData] = useState<Board | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [resource, setResource] = useState<'drivers' | 'vehicles'>('drivers');
  const [suggest, setSuggest] = useState<{
    drivers: Array<{ id: string; employee: { firstName: string; lastName: string } }>;
    vehicles: Array<{ id: string; fleetNumber: string; plate: string }>;
  } | null>(null);

  const load = () =>
    api<Board>(`/planning/board?from=${new Date(from).toISOString()}&mode=${mode}`).then(
      setData,
    );

  useEffect(() => {
    load();
  }, [from, mode]);

  const days = useMemo(() => {
    if (!data) return [];
    const start = new Date(data.from);
    return Array.from({ length: data.days }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [data]);

  const selectedA = data?.assignments.find((a) => a.id === selected);

  async function publishOne(id: string) {
    await api(`/planning/assignments/${id}/publish`, { method: 'POST', body: '{}' });
    setMsg('Affectation publiée');
    load();
  }

  async function publishRange() {
    if (!data) return;
    const r = await api<{ updated: number }>('/planning/publish-range', {
      method: 'POST',
      body: JSON.stringify({ from: data.from, to: data.to, label: `Lot ${mode}` }),
    });
    setMsg(`${r.updated} affectation(s) publiée(s)`);
    load();
  }

  async function unassign(id: string) {
    await api(`/planning/assignments/${id}/unassign`, { method: 'POST', body: '{}' });
    setSelected(null);
    setMsg('Désaffecté');
    load();
  }

  async function loadSuggest() {
    if (!selectedA) return;
    const r = await api(`/planning/suggest-replacement?startsAt=${selectedA.startsAt}&endsAt=${selectedA.endsAt}&excludeDriverId=${selectedA.driverId || ''}`);
    setSuggest(r);
  }

  async function reassign(driverId?: string, vehicleId?: string) {
    if (!selected) return;
    await api(`/planning/assignments/${selected}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ driverId, vehicleId }),
    });
    setMsg('Réaffecté');
    setSuggest(null);
    load();
  }

  async function assignOrphan(missionId: string, startsAt: string, endsAt: string) {
    if (!data?.drivers[0] || !data.vehicles[0]) return;
    const a = await api<{ id: string }>('/planning/assignments', {
      method: 'POST',
      body: JSON.stringify({
        missionId,
        driverId: data.drivers[0].id,
        vehicleId: data.vehicles.find((v) => v.status === 'available')?.id || data.vehicles[0].id,
        startsAt,
        endsAt,
      }),
    });
    await publishOne(a.id);
  }

  if (!data) return <p>Chargement planning…</p>;

  const rangeStart = new Date(data.from).getTime();
  const rangeEnd = new Date(data.to).getTime();
  const range = Math.max(rangeEnd - rangeStart, 1);
  const rows =
    resource === 'drivers'
      ? data.drivers.map((d) => ({
          id: d.id,
          label: `${d.employee.firstName} ${d.employee.lastName}`,
        }))
      : data.vehicles.map((v) => ({
          id: v.id,
          label: `${v.fleetNumber} · ${v.plate}`,
        }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Planning exploitation</h1>
          <p className="text-sm text-[var(--muted)]">
            {data.conflicts.length} conflit(s) · {data.orphans.length} mission(s) orpheline(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['day', 'week', 'fortnight'] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}
              onClick={() => setMode(m)}
            >
              {m === 'day' ? 'Jour' : m === 'week' ? 'Semaine' : 'Quatorzaine'}
            </button>
          ))}
          <button
            className={resource === 'drivers' ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}
            onClick={() => setResource('drivers')}
          >
            Conducteurs
          </button>
          <button
            className={resource === 'vehicles' ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}
            onClick={() => setResource('vehicles')}
          >
            Véhicules
          </button>
          <input
            className="input w-auto"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <button className="btn-primary" onClick={publishRange}>
            Publier la période
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-action">{msg}</p>}

      <div className="card overflow-auto">
        <div className={mode === 'day' ? 'min-w-[700px]' : 'min-w-[1100px]'}>
          <div
            className="grid border-b border-[var(--border)] bg-night/5 text-[10px] uppercase text-[var(--muted)]"
            style={{
              gridTemplateColumns: `180px repeat(${days.length}, 1fr)`,
            }}
          >
            <div className="px-3 py-2">Ressource</div>
            {days.map((d) => (
              <div
                key={d.toISOString()}
                className="border-l border-[var(--border)] px-1 py-2 text-center"
              >
                {d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })}
              </div>
            ))}
          </div>
          {rows.map((row) => {
            const blocks = data.assignments.filter((a) =>
              resource === 'drivers' ? a.driverId === row.id : a.vehicleId === row.id,
            );
            const rests =
              resource === 'drivers'
                ? data.rests.filter((r) => r.driverId === row.id)
                : [];
            const unavs =
              resource === 'drivers'
                ? data.driverUnavs.filter((u) => u.driverId === row.id)
                : [];
            return (
              <div
                key={row.id}
                className="relative grid h-16 border-b border-[var(--border)]"
                style={{ gridTemplateColumns: '180px 1fr' }}
              >
                <div className="flex items-center px-3 text-sm font-medium">{row.label}</div>
                <div className="relative border-l border-[var(--border)]">
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
                  >
                    {days.map((d) => (
                      <div key={d.toISOString()} className="border-l border-[var(--border)]/50" />
                    ))}
                  </div>
                  {unavs.map((u) => {
                    const left = ((new Date(u.startsAt).getTime() - rangeStart) / range) * 100;
                    const width =
                      ((new Date(u.endsAt).getTime() - new Date(u.startsAt).getTime()) / range) *
                      100;
                    return (
                      <div
                        key={u.id}
                        title={u.reason || u.kind}
                        className="absolute top-1 h-12 rounded bg-danger/20 px-1 text-[10px] text-danger"
                        style={{ left: `${Math.max(left, 0)}%`, width: `${Math.max(width, 2)}%` }}
                      >
                        Indispo
                      </div>
                    );
                  })}
                  {rests.map((r) => {
                    const left = ((new Date(r.startsAt).getTime() - rangeStart) / range) * 100;
                    const width =
                      ((new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime()) / range) *
                      100;
                    return (
                      <div
                        key={r.id}
                        className="absolute top-2 h-10 rounded bg-night/15 px-1 text-[10px]"
                        style={{ left: `${Math.max(left, 0)}%`, width: `${Math.max(width, 1)}%` }}
                      >
                        Repos
                      </div>
                    );
                  })}
                  {blocks.map((a) => {
                    const left = ((new Date(a.startsAt).getTime() - rangeStart) / range) * 100;
                    const width = Math.max(
                      ((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / range) *
                        100,
                      1.5,
                    );
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelected(a.id)}
                        title={`${a.mission.number} ${a.mission.title}`}
                        className={`absolute top-2 h-10 overflow-hidden rounded px-1.5 text-left text-[10px] font-semibold text-white ${
                          selected === a.id
                            ? 'ring-2 ring-warn'
                            : a.published
                              ? 'bg-action'
                              : 'bg-warn'
                        }`}
                        style={{
                          left: `${Math.max(left, 0)}%`,
                          width: `${Math.min(width, 100 - Math.max(left, 0))}%`,
                        }}
                      >
                        {a.mission.number}
                        {a.vehicle ? ` · ${a.vehicle.fleetNumber}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Détail sélection</h2>
          {!selectedA && (
            <p className="text-sm text-[var(--muted)]">Cliquez un bloc du Gantt.</p>
          )}
          {selectedA && (
            <>
              <div className="text-sm">
                <div className="font-semibold">
                  {selectedA.mission.number} — {selectedA.mission.title}
                </div>
                <div>
                  {new Date(selectedA.startsAt).toLocaleString('fr-FR')} →{' '}
                  {new Date(selectedA.endsAt).toLocaleString('fr-FR')}
                </div>
                <div>{selectedA.published ? 'Publié' : 'Brouillon'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="btn-ghost border border-[var(--border)]" href={`/app/missions/${selectedA.mission.id}`}>
                  Ouvrir mission
                </Link>
                {!selectedA.published && (
                  <button className="btn-primary" onClick={() => publishOne(selectedA.id)}>
                    Publier
                  </button>
                )}
                <button className="btn-ghost border border-[var(--border)]" onClick={loadSuggest}>
                  Proposer remplacement
                </button>
                <Link
                  className="btn-primary"
                  href={`/app/dressing?assignmentId=${selectedA.id}`}
                >
                  Habillage HLP
                </Link>
                <button className="btn-danger" onClick={() => unassign(selectedA.id)}>
                  Désaffecter
                </button>
              </div>
              {suggest && (
                <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
                  <div className="font-medium">Conducteurs libres</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {suggest.drivers.map((d) => (
                      <button
                        key={d.id}
                        className="btn-primary"
                        onClick={() => reassign(d.id)}
                      >
                        {d.employee.firstName} {d.employee.lastName}
                      </button>
                    ))}
                    {suggest.drivers.length === 0 && <span>Aucun</span>}
                  </div>
                  <div className="mt-2 font-medium">Véhicules libres</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {suggest.vehicles.map((v) => (
                      <button
                        key={v.id}
                        className="btn-ghost border border-[var(--border)]"
                        onClick={() => reassign(undefined, v.id)}
                      >
                        {v.fleetNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Missions orphelines</h2>
          {data.orphans.length === 0 && (
            <p className="text-sm text-[var(--muted)]">Toutes les missions sont affectées.</p>
          )}
          <ul className="space-y-2 text-sm">
            {data.orphans.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div>
                  <div className="font-medium">
                    {m.number} — {m.title}
                  </div>
                  <div className="text-[var(--muted)]">
                    {new Date(m.startsAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => assignOrphan(m.id, m.startsAt, m.endsAt)}
                >
                  Affecter
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <Link href="/app/rosters" className="btn-ghost border border-[var(--border)]">
              Roulements
            </Link>
            <Link href="/app/unavailabilities" className="btn-ghost border border-[var(--border)]">
              Indisponibilités
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
