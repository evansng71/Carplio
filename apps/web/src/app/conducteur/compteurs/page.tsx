'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LEAVE_LABEL } from '../lib';

type Counters = {
  weekHours: number;
  monthHours: number;
  weekServices: number;
  monthServices: number;
  balances: Array<{
    type: string;
    entitled: number;
    used: number;
    remaining: number;
  }>;
  recentEvents: Array<{
    id: string;
    kind: string;
    createdAt: string;
    note?: string | null;
  }>;
};

const EVENT_LABEL: Record<string, string> = {
  service_start: 'Prise de service',
  service_end: 'Fin de service',
  break_start: 'Pause',
  break_end: 'Reprise',
};

export default function DriverCountersPage() {
  const [data, setData] = useState<Counters | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Counters>('/portal/me/counters')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="bg-white px-4 pb-3 pt-3">
        <Link href="/conducteur" className="text-[var(--drv-red)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Compteurs</h1>
        <p className="text-sm text-[var(--drv-muted)]">
          Heures, services et soldes de congés
        </p>
      </div>

      <div className="space-y-4 px-4 py-4">
        {err && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Heures semaine', `${data?.weekHours ?? '—'} h`],
            ['Services semaine', String(data?.weekServices ?? '—')],
            ['Heures mois', `${data?.monthHours ?? '—'} h`],
            ['Services mois', String(data?.monthServices ?? '—')],
          ].map(([l, v]) => (
            <div key={l} className="drv-card p-4">
              <div className="text-[10px] font-bold uppercase text-[var(--drv-muted)]">
                {l}
              </div>
              <div className="mt-1 text-2xl font-black tabular-nums">{v}</div>
            </div>
          ))}
        </div>

        <section className="drv-card p-4">
          <h2 className="text-sm font-bold">Soldes congés</h2>
          <ul className="mt-3 space-y-2">
            {(data?.balances || []).map((b) => (
              <li
                key={b.type}
                className="flex items-center justify-between text-sm"
              >
                <span>{LEAVE_LABEL[b.type] || b.type}</span>
                <span className="font-bold tabular-nums">
                  {b.remaining}
                  <span className="font-normal text-[var(--drv-muted)]">
                    {' '}
                    / {b.entitled} j
                  </span>
                </span>
              </li>
            ))}
            {!data?.balances?.length && (
              <li className="text-sm text-[var(--drv-muted)]">
                Aucun solde initialisé
              </li>
            )}
          </ul>
          <Link
            href="/conducteur/plus/conges"
            className="mt-3 inline-block text-sm font-bold text-[var(--drv-red)]"
          >
            Demander un congé →
          </Link>
        </section>

        <section className="drv-card p-4">
          <h2 className="text-sm font-bold">Derniers pointages</h2>
          <ul className="mt-3 space-y-2">
            {(data?.recentEvents || []).map((e) => (
              <li key={e.id} className="flex justify-between text-sm">
                <span>{EVENT_LABEL[e.kind] || e.kind}</span>
                <span className="text-[var(--drv-muted)]">
                  {new Date(e.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
            {!data?.recentEvents?.length && (
              <li className="text-sm text-[var(--drv-muted)]">
                Aucun pointage récent
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
