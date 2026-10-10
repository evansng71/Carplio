'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, openPrintHtml } from '@/lib/api';

type Mode = 'day' | 'week' | 'fortnight';

type MissionLite = {
  id: string;
  number: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  origin?: string | null;
  destination?: string | null;
  originAddress?: string | null;
  destinationAddress?: string | null;
  passengers: number;
  minSeats?: number | null;
  requiresPmr?: boolean;
  estimatedKm?: number | null;
  stopsJson?: string | null;
  opsNotes?: string | null;
  clientBrief?: string | null;
  roadSheetNotes?: string | null;
  order?: {
    number?: string;
    customer?: { name: string };
    quote?: {
      number?: string;
      serviceType?: string;
      vehicleCategory?: { name: string } | null;
    } | null;
  } | null;
};

type Assignment = {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startsAt: string;
  endsAt: string;
  published: boolean;
  notes?: string | null;
  mission: MissionLite;
  vehicle?: {
    id: string;
    fleetNumber: string;
    plate: string;
    seats?: number;
  } | null;
  driver?: {
    id: string;
    employee: { firstName: string; lastName: string };
  } | null;
};

type DriverStat = {
  driverId: string;
  tteHours: number;
  vacCount: number;
  debut: string | null;
  fin: string | null;
  vehiclesUsed: string[];
  primaryVehicle: {
    fleetNumber: string;
    plate: string;
  } | null;
  weeklyRest: boolean;
  overtime: boolean;
};

type Board = {
  mode: Mode;
  from: string;
  to: string;
  days: number;
  drivers: Array<{
    id: string;
    employee: { firstName: string; lastName: string };
    depot?: { name: string } | null;
  }>;
  vehicles: Array<{
    id: string;
    fleetNumber: string;
    plate: string;
    seats: number;
    status: string;
    hasPmr?: boolean;
  }>;
  assignments: Assignment[];
  rests: Array<{
    id: string;
    driverId: string;
    startsAt: string;
    endsAt: string;
    kind: string;
  }>;
  driverUnavs: Array<{
    id: string;
    driverId: string;
    startsAt: string;
    endsAt: string;
    kind: string;
    reason?: string | null;
  }>;
  orphans: MissionLite[];
  pool: {
    unassigned: MissionLite[];
    cancelled: MissionLite[];
    unprogrammed: MissionLite[];
  };
  driverStats: DriverStat[];
  conflicts: Array<{ type: string; a?: string; b?: string; assignmentId?: string }>;
};

type PoolTab = 'unassigned' | 'unprogrammed' | 'cancelled';

const HOURS = Array.from({ length: 25 }, (_, i) => i);

const BAR_COLORS = [
  'bg-[#2563eb]',
  'bg-[#059669]',
  'bg-[#d97706]',
  'bg-[#7c3aed]',
  'bg-[#db2777]',
  'bg-[#0891b2]',
];

function colorFor(mission: MissionLite) {
  const key = mission.order?.quote?.serviceType || mission.status || mission.number;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % BAR_COLORS.length;
  return BAR_COLORS[h];
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function durationMin(start: string, end: string) {
  return Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  );
}

function parseStops(json?: string | null): Array<{ time?: string; name: string }> {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.map((s) =>
      typeof s === 'string'
        ? { name: s }
        : { time: s.time || s.plannedTime, name: s.name || s.label || 'Arrêt' },
    );
  } catch {
    return [];
  }
}

function pctInDay(iso: string, dayStart: number, dayMs: number) {
  return ((new Date(iso).getTime() - dayStart) / dayMs) * 100;
}

/** Date locale YYYY-MM-DD (évite le décalage UTC de toISOString). */
function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Midi local pour parser une date calendaire sans basculer de jour en UTC. */
function localNoonIso(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

export default function PlanningPage() {
  const [mode, setMode] = useState<Mode>('day');
  const [from, setFrom] = useState(() => localYmd());
  const [data, setData] = useState<Board | null>(null);
  const [resource, setResource] = useState<'drivers' | 'vehicles'>('drivers');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(
    null,
  );
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [placeDriverId, setPlaceDriverId] = useState<string | null>(null);
  const [placeVehicleId, setPlaceVehicleId] = useState('');
  const [poolTab, setPoolTab] = useState<PoolTab>('unassigned');
  const [poolSearch, setPoolSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);

  const load = useCallback(() => {
    return api<Board>(
      `/planning/board?from=${encodeURIComponent(localNoonIso(from))}&mode=${mode}`,
    ).then(setData);
  }, [from, mode]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const dayStart = useMemo(
    () => (data ? new Date(data.from).getTime() : 0),
    [data],
  );
  const dayMs = 86400000;
  const isDay = mode === 'day';

  const selectedAssignment = data?.assignments.find(
    (a) => a.id === selectedAssignmentId,
  );
  const selectedPoolMission =
    data?.pool.unassigned.find((m) => m.id === selectedMissionId) ||
    data?.pool.cancelled.find((m) => m.id === selectedMissionId) ||
    data?.orphans.find((m) => m.id === selectedMissionId) ||
    null;

  const detailMission =
    selectedAssignment?.mission || selectedPoolMission || null;

  const statsByDriver = useMemo(() => {
    const map = new Map<string, DriverStat>();
    data?.driverStats.forEach((s) => map.set(s.driverId, s));
    return map;
  }, [data]);

  const poolRows = useMemo(() => {
    if (!data) return [];
    const src =
      poolTab === 'cancelled'
        ? data.pool.cancelled
        : poolTab === 'unprogrammed'
          ? data.pool.unprogrammed
          : data.pool.unassigned;
    const q = poolSearch.trim().toLowerCase();
    if (!q) return src;
    return src.filter((m) =>
      [
        m.number,
        m.title,
        m.origin,
        m.destination,
        m.order?.customer?.name,
        m.order?.number,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [data, poolTab, poolSearch]);

  function shiftDay(delta: number) {
    const [y, m, d] = from.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + delta);
    setFrom(localYmd(date));
  }

  async function placeOnDriver(
    driverId: string,
    vehicleId?: string,
    missionId?: string,
  ) {
    const mid = missionId || selectedMissionId;
    if (!mid) {
      setErr(
        'Sélectionnez d’abord une mission non affectée dans le panneau du bas',
      );
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const a = await api<Assignment>('/planning/place', {
        method: 'POST',
        body: JSON.stringify({
          missionId: mid,
          driverId,
          vehicleId: vehicleId || placeVehicleId || undefined,
          publish: true,
        }),
      });
      setMsg(
        `Mission placée sur le planning (${a.mission?.number || mid})`,
      );
      setSelectedMissionId(null);
      setPlaceDriverId(null);
      setSelectedAssignmentId(a.id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unassign(id: string) {
    setBusy(true);
    try {
      await api(`/planning/assignments/${id}/unassign`, {
        method: 'POST',
        body: '{}',
      });
      setSelectedAssignmentId(null);
      setMsg('Mission désaffectée — revenue dans Non affectés');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publishOne(id: string) {
    await api(`/planning/assignments/${id}/publish`, {
      method: 'POST',
      body: '{}',
    });
    setMsg('Affectation publiée');
    load();
  }

  async function publishRange() {
    if (!data) return;
    const r = await api<{ updated: number }>('/planning/publish-range', {
      method: 'POST',
      body: JSON.stringify({
        from: data.from,
        to: data.to,
        label: `Lot ${mode}`,
      }),
    });
    setMsg(`${r.updated} affectation(s) publiée(s)`);
    load();
  }

  async function autoAssignDay() {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ assigned: number; failed: number; total: number }>(
        '/ops/auto-assign',
        { method: 'POST', body: JSON.stringify({ date: from, dryRun: false }) },
      );
      setMsg(
        `Auto-affectation : ${r.assigned}/${r.total}${r.failed ? ` · ${r.failed} échec(s)` : ''}`,
      );
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !err) {
    return <p className="text-sm text-[var(--muted)]">Chargement planning…</p>;
  }
  if (!data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }

  const dayLabel = new Date(data.from).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const ganttWidth = isDay ? Math.round(1100 * zoom) : Math.max(data.days * 120, 900);

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-2">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="page-kicker">Module exploitation</p>
          <h1 className="truncate text-lg font-bold capitalize sm:text-xl">
            Construction planning — {dayLabel}
          </h1>
          <p className="text-xs text-[var(--muted)]">
            {data.conflicts.length} conflit(s) · {data.pool.unassigned.length}{' '}
            non affectée(s) · sélectionnez une mission puis un conducteur pour
            placer
          </p>
        </div>
        <div className="flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" className="btn-secondary" onClick={() => shiftDay(-1)}>
            ←
          </button>
          <input
            className="input w-auto"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={() => shiftDay(1)}>
            →
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFrom(localYmd());
              setMode('day');
            }}
          >
            Aujourd’hui
          </button>
          {(['day', 'week', 'fortnight'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={
                mode === m ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'
              }
              onClick={() => setMode(m)}
            >
              {m === 'day' ? 'Jour' : m === 'week' ? 'Semaine' : '14 j'}
            </button>
          ))}
          <button
            type="button"
            className={
              resource === 'drivers'
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }
            onClick={() => setResource('drivers')}
          >
            Conducteurs
          </button>
          <button
            type="button"
            className={
              resource === 'vehicles'
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }
            onClick={() => setResource('vehicles')}
          >
            Véhicules
          </button>
          {isDay && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-ghost border border-[var(--border)] px-2"
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
              >
                −
              </button>
              <span className="text-xs text-[var(--muted)]">Zoom</span>
              <button
                type="button"
                className="btn-ghost border border-[var(--border)] px-2"
                onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={autoAssignDay}
          >
            Auto-affecter
          </button>
          <button type="button" className="btn-secondary" onClick={publishRange}>
            Publier
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              openPrintHtml(
                `/documents/print/planning?from=${encodeURIComponent(from)}&to=${encodeURIComponent(data.to.slice(0, 10))}`,
              ).catch((e) => setErr(e.message))
            }
          >
            Imprimer
          </button>
          <Link href="/app/ops" className="btn-ghost border border-[var(--border)]">
            Cockpit
          </Link>
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      {selectedMissionId && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-action/30 bg-action/5 px-3 py-1.5 text-sm">
          <span className="font-medium">
            Mission sélectionnée : {selectedPoolMission?.number} — cliquez une
            ligne conducteur pour placer
          </span>
          <select
            className="input w-auto text-sm"
            value={placeVehicleId}
            onChange={(e) => setPlaceVehicleId(e.target.value)}
          >
            <option value="">Véhicule auto</option>
            {data.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.fleetNumber} · {v.plate} · {v.seats} pl.
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => setSelectedMissionId(null)}
          >
            Annuler sélection
          </button>
        </div>
      )}

      {/* Main split: Gantt + detail */}
      <div className="grid min-h-[360px] flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card min-h-[320px] overflow-hidden p-0">
          <div className="h-full min-h-[300px] overflow-auto">
            <div style={{ minWidth: isDay ? ganttWidth + 340 : ganttWidth + 200 }}>
              {/* Header hours */}
              <div
                className="sticky top-0 z-20 grid border-b border-[var(--border)] bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[var(--muted)]"
                style={{
                  gridTemplateColumns: isDay
                    ? '200px 110px 56px 40px 52px 1fr'
                    : '200px 1fr',
                }}
              >
                <div className="px-3 py-2 font-semibold">Conducteur</div>
                {isDay && (
                  <>
                    <div className="border-l border-[var(--border)] px-2 py-2">
                      Véhicule
                    </div>
                    <div className="border-l border-[var(--border)] px-1 py-2 text-center">
                      TTE
                    </div>
                    <div className="border-l border-[var(--border)] px-1 py-2 text-center">
                      Vac.
                    </div>
                    <div className="border-l border-[var(--border)] px-1 py-2 text-center">
                      Début
                    </div>
                  </>
                )}
                <div className="relative border-l border-[var(--border)]">
                  {isDay ? (
                    <div
                      className="relative h-8"
                      style={{ width: ganttWidth }}
                    >
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 h-full border-l border-[var(--border)]/60 px-0.5 pt-1"
                          style={{ left: `${(h / 24) * 100}%` }}
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="grid h-8"
                      style={{
                        gridTemplateColumns: `repeat(${data.days}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: data.days }, (_, i) => {
                        const d = new Date(data.from);
                        d.setDate(d.getDate() + i);
                        return (
                          <div
                            key={i}
                            className="border-l border-[var(--border)] px-1 py-2 text-center"
                          >
                            {d.toLocaleDateString('fr-FR', {
                              weekday: 'short',
                              day: '2-digit',
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Rows */}
              {(resource === 'drivers' ? data.drivers : data.vehicles).map(
                (row) => {
                  const isDriver = resource === 'drivers';
                  const driverId = isDriver ? row.id : null;
                  const vehicleId = !isDriver ? row.id : null;
                  const label = isDriver
                    ? `${(row as Board['drivers'][0]).employee.lastName.toUpperCase()} ${(row as Board['drivers'][0]).employee.firstName}`
                    : `${(row as Board['vehicles'][0]).fleetNumber} · ${(row as Board['vehicles'][0]).plate}`;
                  const stats = isDriver
                    ? statsByDriver.get(row.id)
                    : undefined;
                  const blocks = data.assignments.filter((a) =>
                    isDriver ? a.driverId === row.id : a.vehicleId === row.id,
                  );
                  const rests = isDriver
                    ? data.rests.filter((r) => r.driverId === row.id)
                    : [];
                  const unavs = isDriver
                    ? data.driverUnavs.filter((u) => u.driverId === row.id)
                    : [];
                  const placing =
                    selectedMissionId &&
                    placeDriverId === row.id &&
                    isDriver;
                  const canPlace =
                    !!selectedMissionId && isDriver && !stats?.weeklyRest;

                  return (
                    <div
                      key={row.id}
                      className={`grid border-b border-[var(--border)] ${
                        canPlace ? 'cursor-pointer hover:bg-action/5' : ''
                      } ${placing ? 'bg-action/10' : ''} ${
                        stats?.weeklyRest ? 'bg-slate-100/80' : ''
                      }`}
                      style={{
                        gridTemplateColumns: isDay
                          ? '200px 110px 56px 40px 52px 1fr'
                          : '200px 1fr',
                        minHeight: 44,
                      }}
                      onClick={() => {
                        if (!canPlace || !driverId) return;
                        setPlaceDriverId(driverId);
                        placeOnDriver(driverId, placeVehicleId || undefined);
                      }}
                    >
                      <div className="flex items-center gap-2 truncate px-3 text-xs font-semibold">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            stats?.overtime
                              ? 'bg-rose-500'
                              : stats?.weeklyRest
                                ? 'bg-slate-400'
                                : 'bg-emerald-500'
                          }`}
                        />
                        <span className="truncate">{label}</span>
                      </div>
                      {isDay && isDriver && (
                        <>
                          <div className="flex items-center border-l border-[var(--border)] px-2 text-[11px] text-[var(--muted)]">
                            {stats?.primaryVehicle
                              ? `${stats.primaryVehicle.fleetNumber}`
                              : stats?.vehiclesUsed[0] || '—'}
                          </div>
                          <div
                            className={`flex items-center justify-center border-l border-[var(--border)] text-[11px] font-semibold tabular-nums ${
                              stats?.overtime ? 'bg-rose-100 text-rose-800' : ''
                            }`}
                          >
                            {stats ? stats.tteHours.toFixed(2) : '0.00'}
                          </div>
                          <div className="flex items-center justify-center border-l border-[var(--border)] text-[11px] tabular-nums">
                            {stats?.vacCount ?? 0}
                          </div>
                          <div className="flex items-center justify-center border-l border-[var(--border)] text-[11px] tabular-nums">
                            {fmtTime(stats?.debut)}
                          </div>
                        </>
                      )}
                      {isDay && !isDriver && (
                        <>
                          <div className="border-l border-[var(--border)]" />
                          <div className="border-l border-[var(--border)]" />
                          <div className="border-l border-[var(--border)]" />
                          <div className="border-l border-[var(--border)]" />
                        </>
                      )}
                      <div
                        className="relative border-l border-[var(--border)]"
                        style={{
                          width: isDay ? ganttWidth : undefined,
                          minHeight: 44,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* hour grid */}
                        {isDay &&
                          HOURS.map((h) => (
                            <div
                              key={h}
                              className="pointer-events-none absolute inset-y-0 border-l border-[var(--border)]/40"
                              style={{ left: `${(h / 24) * 100}%` }}
                            />
                          ))}

                        {stats?.weeklyRest && isDay && (
                          <div className="absolute inset-y-1 left-[5%] right-[5%] flex items-center justify-center rounded bg-slate-300/70 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Repos hebdomadaire
                          </div>
                        )}

                        {unavs.map((u) => {
                          const left = Math.max(
                            0,
                            pctInDay(u.startsAt, dayStart, dayMs),
                          );
                          const right = Math.min(
                            100,
                            pctInDay(u.endsAt, dayStart, dayMs),
                          );
                          return (
                            <div
                              key={u.id}
                              title={u.reason || u.kind}
                              className="absolute top-1 h-8 rounded bg-rose-200/80 px-1 text-[9px] text-rose-900"
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(right - left, 1)}%`,
                              }}
                            >
                              Indispo
                            </div>
                          );
                        })}

                        {rests.map((r) => {
                          const left = Math.max(
                            0,
                            pctInDay(r.startsAt, dayStart, dayMs),
                          );
                          const right = Math.min(
                            100,
                            pctInDay(r.endsAt, dayStart, dayMs),
                          );
                          return (
                            <div
                              key={r.id}
                              className="absolute top-1 flex h-8 items-center justify-center rounded bg-slate-300/80 px-1 text-[9px] font-medium uppercase text-slate-700"
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(right - left, 1)}%`,
                              }}
                            >
                              Repos
                            </div>
                          );
                        })}

                        {blocks.map((a) => {
                          const rangeStart = dayStart;
                          const range =
                            mode === 'day'
                              ? dayMs
                              : new Date(data.to).getTime() - dayStart;
                          const left = Math.max(
                            0,
                            ((new Date(a.startsAt).getTime() - rangeStart) /
                              range) *
                              100,
                          );
                          const width = Math.max(
                            1.2,
                            ((new Date(a.endsAt).getTime() -
                              new Date(a.startsAt).getTime()) /
                              range) *
                              100,
                          );
                          const active = selectedAssignmentId === a.id;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setSelectedAssignmentId(a.id);
                                setSelectedMissionId(null);
                              }}
                              title={`${a.mission.number} ${a.mission.title}\n${fmtDateTime(a.startsAt)} → ${fmtDateTime(a.endsAt)}`}
                              className={`absolute top-1.5 h-7 overflow-hidden rounded px-1.5 text-left text-[10px] font-semibold text-white shadow-sm ${colorFor(a.mission)} ${
                                active ? 'ring-2 ring-offset-1 ring-amber-400' : ''
                              } ${!a.published ? 'opacity-80 ring-1 ring-dashed ring-white/70' : ''}`}
                              style={{
                                left: `${left}%`,
                                width: `${Math.min(width, 100 - left)}%`,
                              }}
                            >
                              <span className="block truncate">
                                {a.mission.number}{' '}
                                {(a.mission.origin || a.mission.title).slice(
                                  0,
                                  18,
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <aside className="card min-h-0 overflow-auto p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            Informations
          </h2>
          {!detailMission && (
            <p className="text-sm text-[var(--muted)]">
              Cliquez une vacation sur le Gantt, ou une mission non affectée
              ci-dessous.
            </p>
          )}
          {detailMission && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-lg font-bold">{detailMission.number}</div>
                <div className="font-medium">{detailMission.title}</div>
                <div className="text-xs text-[var(--muted)]">
                  {detailMission.order?.customer?.name || '—'}
                  {detailMission.order?.quote?.number
                    ? ` · Devis ${detailMission.order.quote.number}`
                    : ''}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--surface-2)] p-3 text-xs leading-relaxed">
                <div>
                  <strong>Durée :</strong>{' '}
                  {durationMin(detailMission.startsAt, detailMission.endsAt)} mn
                </div>
                <div>
                  <strong>Départ :</strong> {fmtDateTime(detailMission.startsAt)}
                </div>
                <div>
                  <strong>Arrivée :</strong> {fmtDateTime(detailMission.endsAt)}
                </div>
                <div>
                  <strong>Trajet :</strong> {detailMission.origin || '—'} →{' '}
                  {detailMission.destination || '—'}
                </div>
                {detailMission.originAddress && (
                  <div>
                    <strong>Adr. départ :</strong>{' '}
                    {detailMission.originAddress}
                  </div>
                )}
                {detailMission.destinationAddress && (
                  <div>
                    <strong>Adr. arrivée :</strong>{' '}
                    {detailMission.destinationAddress}
                  </div>
                )}
                <div>
                  <strong>Passagers :</strong> {detailMission.passengers}
                  {detailMission.minSeats
                    ? ` (min ${detailMission.minSeats} pl.)`
                    : ''}
                  {detailMission.requiresPmr ? ' · PMR' : ''}
                </div>
                {detailMission.order?.quote?.vehicleCategory && (
                  <div>
                    <strong>Famille véhicule :</strong>{' '}
                    {detailMission.order.quote.vehicleCategory.name}
                  </div>
                )}
                {detailMission.estimatedKm != null && (
                  <div>
                    <strong>Km estimés :</strong> {detailMission.estimatedKm}
                  </div>
                )}
                {selectedAssignment?.vehicle && (
                  <div>
                    <strong>Véhicule :</strong>{' '}
                    {selectedAssignment.vehicle.fleetNumber} ·{' '}
                    {selectedAssignment.vehicle.plate}
                  </div>
                )}
                {selectedAssignment?.driver && (
                  <div>
                    <strong>Conducteur :</strong>{' '}
                    {selectedAssignment.driver.employee.firstName}{' '}
                    {selectedAssignment.driver.employee.lastName}
                  </div>
                )}
              </div>

              {parseStops(detailMission.stopsJson).length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">
                    Itinéraire
                  </div>
                  <ul className="space-y-1 text-xs">
                    {parseStops(detailMission.stopsJson).map((s, i) => (
                      <li key={i}>
                        {s.time ? `${s.time} : ` : ''}
                        {s.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(detailMission.clientBrief ||
                detailMission.opsNotes ||
                detailMission.roadSheetNotes) && (
                <div className="space-y-1 text-xs">
                  {detailMission.clientBrief && (
                    <p>
                      <strong>Brief :</strong> {detailMission.clientBrief}
                    </p>
                  )}
                  {detailMission.opsNotes && (
                    <p>
                      <strong>Ops :</strong> {detailMission.opsNotes}
                    </p>
                  )}
                  {detailMission.roadSheetNotes && (
                    <p>
                      <strong>Feuille de route :</strong>{' '}
                      {detailMission.roadSheetNotes}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  className="btn-secondary text-xs"
                  href={`/app/missions/${detailMission.id}`}
                >
                  Ouvrir mission
                </Link>
                {selectedAssignment && !selectedAssignment.published && (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() => publishOne(selectedAssignment.id)}
                  >
                    Publier
                  </button>
                )}
                {selectedAssignment && (
                  <>
                    <Link
                      className="btn-secondary text-xs"
                      href={`/app/dressing?assignmentId=${selectedAssignment.id}`}
                    >
                      Habillage HLP
                    </Link>
                    <button
                      type="button"
                      className="btn-danger text-xs"
                      disabled={busy}
                      onClick={() => unassign(selectedAssignment.id)}
                    >
                      Désaffecter
                    </button>
                  </>
                )}
                {selectedPoolMission && (
                  <p className="w-full text-xs text-action">
                    Cliquez une ligne conducteur du Gantt pour placer cette
                    mission.
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom pool */}
      <div className="card flex h-[240px] max-h-[32vh] min-h-[160px] shrink-0 flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[#f8fafc] px-2 pt-2">
          {(
            [
              ['unassigned', `Non affectés (${data.pool.unassigned.length})`],
              [
                'unprogrammed',
                `Non programmés (${data.pool.unprogrammed.length})`,
              ],
              ['cancelled', `Annulés (${data.pool.cancelled.length})`],
            ] as Array<[PoolTab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-t-lg px-3 py-1.5 text-xs font-medium ${
                poolTab === key
                  ? 'bg-white text-night shadow-sm'
                  : 'text-[var(--muted)] hover:text-night'
              }`}
              onClick={() => setPoolTab(key)}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto pb-1.5 pr-1">
            <input
              className="input h-8 w-56 text-xs"
              placeholder="Rechercher mission, client…"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Pax</th>
                <th className="px-3 py-2">N°</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2">Départ</th>
                <th className="px-3 py-2">Arrivée</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Lieu départ</th>
                <th className="px-3 py-2">Lieu arrivée</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {poolRows.map((m) => {
                const active = selectedMissionId === m.id;
                return (
                  <tr
                    key={m.id}
                    className={`cursor-pointer border-t border-[var(--border)] ${
                      active
                        ? 'bg-action/10'
                        : m.requiresPmr
                          ? 'bg-teal-50/50'
                          : 'hover:bg-[var(--surface-2)]/60'
                    }`}
                    onClick={() => {
                      setSelectedMissionId(m.id);
                      setSelectedAssignmentId(null);
                    }}
                  >
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {m.passengers}
                      {m.requiresPmr ? ' PMR' : ''}
                    </td>
                    <td className="px-3 py-2 font-semibold">{m.number}</td>
                    <td className="px-3 py-2">{m.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDateTime(m.startsAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDateTime(m.endsAt)}
                    </td>
                    <td className="px-3 py-2">
                      {m.order?.customer?.name || '—'}
                    </td>
                    <td className="px-3 py-2">{m.origin || '—'}</td>
                    <td className="px-3 py-2">{m.destination || '—'}</td>
                    <td className="px-3 py-2">
                      {poolTab !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn-primary px-2 py-1 text-[10px]"
                          disabled={busy || !data.drivers[0]}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMissionId(m.id);
                            setSelectedAssignmentId(null);
                            const free =
                              data.drivers.find((d) => {
                                const st = statsByDriver.get(d.id);
                                return !st?.weeklyRest;
                              }) || data.drivers[0];
                            void placeOnDriver(
                              free.id,
                              placeVehicleId || undefined,
                              m.id,
                            );
                          }}
                        >
                          Placer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {poolRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-[var(--muted)]"
                  >
                    Aucune mission dans cet onglet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
