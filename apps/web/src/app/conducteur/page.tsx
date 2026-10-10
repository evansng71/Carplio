'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ServiceCard } from './components/ServiceCard';
import {
  DAY_SHORT,
  type Assignment,
  type DayMarker,
  weekDays,
  ymd,
} from './lib';

type TodayPayload = {
  date: string;
  assignments: Assignment[];
  rests: Array<{ id: string; kind: string }>;
  leave?: { type: string; status: string } | null;
  next: Assignment | null;
  tasks: Array<{ id: string; label: string; days: number; kind: string }>;
  unreadMessages: number;
  driver: { firstName: string; lastName: string; depot?: string };
};

export default function DriverHomePage() {
  const { me } = useAuth();
  const [selected, setSelected] = useState(ymd(new Date()));
  const [data, setData] = useState<TodayPayload | null>(null);
  const [markers, setMarkers] = useState<DayMarker[]>([]);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const week = useMemo(() => weekDays(new Date(selected + 'T12:00:00')), [selected]);

  const load = useCallback(async () => {
    try {
      const from = ymd(week[0]);
      const to = ymd(week[6]);
      const [day, plan] = await Promise.all([
        api<TodayPayload>(`/portal/me/today?date=${selected}`),
        api<{ days: DayMarker[] }>(
          `/portal/me/planning?from=${from}&to=${to}`,
        ),
      ]);
      setData(day);
      setMarkers(plan.days || []);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, [selected, week]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  const markerMap = useMemo(() => {
    const m = new Map<string, DayMarker>();
    for (const d of markers) m.set(d.date, d);
    return m;
  }, [markers]);

  async function priseService(a: Assignment) {
    setBusy(true);
    setNote('');
    try {
      await api('/portal/me/service-event', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'service_start',
          missionId: a.mission.id,
        }),
      });
      await api('/portal/me/ack', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'planning_seen',
          missionId: a.mission.id,
        }),
      });
      setNote('Prise de service enregistrée');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="drv-red-head px-4 pb-4 pt-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg font-bold">
            {(me?.displayName || 'C').slice(0, 1)}
          </div>
          <Link
            href="/conducteur/plus/profil"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40"
            aria-label="Profil"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
            </svg>
          </Link>
        </div>

        <div className="flex justify-between gap-1">
          {week.map((d, i) => {
            const key = ymd(d);
            const active = key === selected;
            const mk = markerMap.get(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] font-semibold text-white/80">
                  {DAY_SHORT[i]}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    active
                      ? 'bg-white text-[var(--drv-red)]'
                      : 'text-white'
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-4 min-w-[1.5rem] items-center justify-center text-[9px] font-bold text-white/90">
                  {mk?.code ? (
                    mk.code
                  ) : mk && mk.assignmentCount > 0 ? (
                    <span className="flex gap-0.5">
                      {Array.from({
                        length: Math.min(mk.assignmentCount, 4),
                      }).map((_, j) => (
                        <span
                          key={j}
                          className="h-1 w-1 rounded-full bg-white"
                        />
                      ))}
                    </span>
                  ) : (
                    ''
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="-mt-1 space-y-4 px-4 pb-6 pt-5">
        {(err || note) && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              err
                ? 'bg-rose-50 text-rose-700'
                : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {err || note}
          </div>
        )}

        {data?.leave && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Absence prévue ce jour ({data.leave.type}) — {data.leave.status}
          </div>
        )}

        {data?.assignments?.length ? (
          data.assignments.map((a, i) => (
            <ServiceCard
              key={a.id}
              assignment={a}
              index={i}
              total={data.assignments.length}
              starting={busy}
              onStart={() => priseService(a)}
            />
          ))
        ) : data?.rests?.length ? (
          <div className="drv-card p-5 text-center">
            <div className="text-lg font-bold">Repos</div>
            <p className="mt-1 text-sm text-[var(--drv-muted)]">
              Aucun service publié — journée de repos.
            </p>
          </div>
        ) : (
          <div className="drv-card p-5 text-center">
            <div className="text-lg font-bold">Aucun service</div>
            <p className="mt-1 text-sm text-[var(--drv-muted)]">
              Pas de vacation publiée pour cette date.
            </p>
          </div>
        )}

        {(data?.tasks?.length || 0) > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-bold">Tâches en attente</h3>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {data!.tasks.map((t) => (
                <div
                  key={t.id}
                  className="drv-card min-w-[7.5rem] shrink-0 p-3"
                >
                  <div className="text-2xl font-black text-[var(--drv-red)]">
                    {t.days >= 0 ? `J+${t.days}` : `J${t.days}`}
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-tight text-[var(--drv-muted)]">
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
