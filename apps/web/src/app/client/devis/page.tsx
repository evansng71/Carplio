'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { IconFile } from '@/components/Icons';
import { badgeClass, dt, money, QUOTE_STATUS } from '../lib';

type Quote = {
  id: string;
  number: string;
  title: string;
  status: string;
  origin?: string | null;
  destination?: string | null;
  departureAt?: string | null;
  passengers: number;
  amountHt: number;
  amountTtc: number;
  validUntil?: string | null;
};

export default function ClientQuotesPage() {
  const [rows, setRows] = useState<Quote[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Quote[]>('/client-portal/quotes')
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="cli-kicker">Commercial</p>
          <h1 className="cli-h1 mt-1">Mes devis</h1>
          <p className="cli-sub">
            Consultez, acceptez ou refusez vos propositions.
          </p>
        </div>
        <Link href="/client/demande" className="cli-btn cli-btn-primary">
          Demander un devis
        </Link>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <ul className="space-y-3">
        {rows.map((q) => (
          <li key={q.id}>
            <Link
              href={`/client/devis/${q.id}`}
              className="cli-card cli-card-interactive cli-list-row"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  className={`cli-ico ${
                    q.status === 'sent' ? 'cli-ico-amber' : 'cli-ico-cyan'
                  }`}
                >
                  <IconFile size={18} />
                </span>
                <div className="min-w-0">
                  <div className="font-bold">{q.title}</div>
                  <div className="text-xs text-[var(--cli-muted)]">
                    {q.number}
                    {q.origin ? ` · ${q.origin} → ${q.destination}` : ''}
                  </div>
                  <div className="mt-2 text-sm">
                    {q.departureAt ? dt(q.departureAt) : 'Date à préciser'} ·{' '}
                    {q.passengers} pax
                  </div>
                  {q.validUntil && (
                    <div className="mt-1 text-xs text-[var(--cli-muted)]">
                      Valable jusqu’au {dt(q.validUntil, false)}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={badgeClass(
                    q.status === 'sent'
                      ? 'warn'
                      : q.status === 'accepted'
                        ? 'ok'
                        : 'muted',
                  )}
                >
                  {QUOTE_STATUS[q.status] || q.status}
                </span>
                <div className="mt-2 text-lg font-bold">
                  {money(q.amountTtc)}
                </div>
                <div className="text-[11px] text-[var(--cli-muted)]">TTC</div>
              </div>
            </Link>
          </li>
        ))}
        {!rows.length && !err && (
          <li className="cli-card p-8 text-center text-sm text-[var(--cli-muted)]">
            Aucun devis pour le moment.
          </li>
        )}
      </ul>
    </div>
  );
}
