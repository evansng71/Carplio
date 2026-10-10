'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  DAY_SHORT,
  type DayMarker,
  monthGrid,
  ymd,
} from '../lib';

export default function DriverPlanningPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12),
  );
  const [markers, setMarkers] = useState<DayMarker[]>([]);
  const [err, setErr] = useState('');

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  const load = useCallback(async () => {
    try {
      const from = ymd(cells[0]);
      const to = ymd(cells[cells.length - 1]);
      const plan = await api<{ days: DayMarker[] }>(
        `/portal/me/planning?from=${from}&to=${to}`,
      );
      setMarkers(plan.days || []);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }, [cells]);

  useEffect(() => {
    load();
  }, [load]);

  const map = useMemo(() => {
    const m = new Map<string, DayMarker>();
    for (const d of markers) m.set(d.date, d);
    return m;
  }, [markers]);

  const title = cursor.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <header className="drv-red-head px-4 pb-5 pt-3">
        <Link
          href="/conducteur"
          className="inline-flex items-center gap-1 text-sm font-semibold text-white"
        >
          ← Retour
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Mon planning</h1>
        <div className="mt-4 flex justify-between text-[11px] font-bold text-white/90">
          {DAY_SHORT.map((d) => (
            <span key={d} className="w-[14%] text-center">
              {d}
            </span>
          ))}
        </div>
      </header>

      <div className="bg-white px-3 pb-6 pt-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <button
            type="button"
            className="text-sm font-semibold text-[var(--drv-red)]"
            onClick={() =>
              setCursor(new Date(year, month - 1, 1, 12))
            }
          >
            ‹
          </button>
          <h2 className="text-base font-bold capitalize">{title}</h2>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--drv-red)]"
            onClick={() =>
              setCursor(new Date(year, month + 1, 1, 12))
            }
          >
            ›
          </button>
        </div>

        {err && (
          <p className="mb-2 text-sm text-rose-600">{err}</p>
        )}

        <div className="grid grid-cols-7 gap-y-2">
          {cells.map((d) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === month;
            const mk = map.get(key);
            const isToday = key === ymd(new Date());
            return (
              <Link
                key={key}
                href={`/conducteur/jour/${key}`}
                className={`relative mx-auto flex h-14 w-11 flex-col items-center rounded-lg pt-1 ${
                  mk?.provisional ? 'bg-gray-100' : ''
                } ${!inMonth ? 'opacity-35' : ''}`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday
                      ? 'bg-[var(--drv-red)] text-white'
                      : 'text-[var(--drv-ink)]'
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="mt-0.5 text-[9px] font-bold text-gray-400">
                  {mk?.code ? (
                    mk.code
                  ) : mk && mk.assignmentCount > 0 ? (
                    <span className="flex gap-0.5">
                      {Array.from({
                        length: Math.min(mk.assignmentCount, 4),
                      }).map((_, j) => (
                        <span
                          key={j}
                          className={`h-1 w-1 rounded-full ${
                            isToday ? 'bg-white' : 'bg-gray-400'
                          }`}
                        />
                      ))}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-bold">Planning prévisionnel</h3>
          <div className="mt-2 flex items-start gap-2 text-xs text-[var(--drv-muted)]">
            <span className="mt-0.5 inline-block h-3 w-3 rounded-sm bg-gray-200" />
            <p>
              Le planning de ces dates n’est pas définitif — seuls les services
              publiés sont visibles.
            </p>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-[var(--drv-muted)]">
            <li>
              <strong>CP / RTT</strong> — congés · <strong>R / RH</strong> — repos
            </li>
            <li>
              <strong>• •</strong> — nombre de services publiés
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
