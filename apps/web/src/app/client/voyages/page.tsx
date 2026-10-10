'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { IconRoute, IconUsers } from '@/components/Icons';
import { badgeClass, dt, TRIP_STATUS } from '../lib';

type Trip = {
  id: string;
  number: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  origin?: string | null;
  destination?: string | null;
  passengers: number;
  clientBrief?: string | null;
  order: { number: string; customerPoNumber?: string | null };
};

export default function ClientTripsPage() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [rows, setRows] = useState<Trip[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Trip[]>(`/client-portal/trips?scope=${scope === 'past' ? 'past' : ''}`)
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, [scope]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="cli-kicker">Planning</p>
          <h1 className="cli-h1 mt-1">Mes voyages</h1>
          <p className="cli-sub">Prestations confirmées et historique.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`cli-btn ${scope === 'upcoming' ? 'cli-btn-primary' : 'cli-btn-ghost'}`}
            onClick={() => setScope('upcoming')}
          >
            À venir
          </button>
          <button
            type="button"
            className={`cli-btn ${scope === 'past' ? 'cli-btn-primary' : 'cli-btn-ghost'}`}
            onClick={() => setScope('past')}
          >
            Passés
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <ul className="space-y-3">
        {rows.map((t) => (
          <li key={t.id} className="cli-card cli-list-row">
            <div className="flex min-w-0 gap-3">
              <span className="cli-ico cli-ico-cyan">
                <IconRoute size={18} />
              </span>
              <div className="min-w-0">
                <div className="font-bold">{t.title}</div>
                <div className="text-sm text-[var(--cli-muted)]">
                  {t.origin} → {t.destination}
                </div>
                <div className="mt-2 text-sm font-medium">
                  {dt(t.startsAt)} → {dt(t.endsAt)}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--cli-muted)]">
                  <span>{t.number}</span>
                  <span>· Commande {t.order.number}</span>
                  {t.order.customerPoNumber && (
                    <span>· BC {t.order.customerPoNumber}</span>
                  )}
                </div>
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                    <IconUsers size={12} /> {t.passengers} voyageurs
                  </span>
                </div>
                {t.clientBrief && (
                  <p className="mt-2 text-sm text-[var(--cli-muted)]">
                    {t.clientBrief}
                  </p>
                )}
              </div>
            </div>
            <span
              className={badgeClass(
                t.status === 'cancelled' ? 'muted' : 'info',
              )}
            >
              {TRIP_STATUS[t.status] || t.status}
            </span>
          </li>
        ))}
        {!rows.length && !err && (
          <li className="cli-card p-8 text-center text-sm text-[var(--cli-muted)]">
            Aucun voyage {scope === 'past' ? 'passé' : 'à venir'}.
          </li>
        )}
      </ul>
    </div>
  );
}
