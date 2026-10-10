'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { badgeClass, dt, money, QUOTE_STATUS } from '../../lib';

type Quote = {
  id: string;
  number: string;
  title: string;
  status: string;
  origin?: string | null;
  destination?: string | null;
  departureAt?: string | null;
  returnAt?: string | null;
  passengers: number;
  amountHt: number;
  amountTtc: number;
  vatRate: number;
  validUntil?: string | null;
  availabilityNote?: string | null;
  refusedReason?: string | null;
  salesperson?: { displayName: string; email: string } | null;
  lines: Array<{
    id: string;
    label: string;
    quantity: number;
    unit: string;
    unitPriceHt: number;
    amountHt: number;
  }>;
};

export default function ClientQuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const row = await api<Quote>(`/client-portal/quotes/${id}`);
    setQ(row);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <p className="text-sm text-rose-600">{err}</p>;
  if (!q) return <p className="text-sm text-[var(--cli-muted)]">Chargement…</p>;

  return (
    <div className="space-y-4">
      <Link href="/client/devis" className="text-sm font-semibold text-[var(--cli-accent)]">
        ← Devis
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="cli-h1">{q.title}</h1>
          <p className="cli-sub">
            {q.number}
            {q.salesperson ? ` · ${q.salesperson.displayName}` : ''}
          </p>
        </div>
        <span
          className={badgeClass(
            q.status === 'sent' ? 'warn' : q.status === 'accepted' ? 'ok' : 'muted',
          )}
        >
          {QUOTE_STATUS[q.status] || q.status}
        </span>
      </div>

      <section className="cli-card space-y-2 p-4 text-sm">
        <div>
          {q.origin} → {q.destination}
        </div>
        <div>
          Départ {dt(q.departureAt)}
          {q.returnAt ? ` · Retour ${dt(q.returnAt)}` : ''}
        </div>
        <div>{q.passengers} voyageurs</div>
        {q.validUntil && (
          <div className="text-[var(--cli-muted)]">
            Offre valable jusqu’au {dt(q.validUntil, false)}
          </div>
        )}
        {q.availabilityNote && (
          <div className="rounded-xl bg-[var(--cli-accent-soft)] px-3 py-2 text-[var(--cli-accent)]">
            {q.availabilityNote}
          </div>
        )}
        {q.refusedReason && (
          <div className="text-rose-700">Motif refus : {q.refusedReason}</div>
        )}
      </section>

      <section className="cli-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cli-bg)] text-left text-xs uppercase text-[var(--cli-muted)]">
            <tr>
              <th className="px-4 py-2">Ligne</th>
              <th className="px-2 py-2">Qté</th>
              <th className="px-4 py-2 text-right">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.id} className="border-t border-[var(--cli-line)]">
                <td className="px-4 py-2">{l.label}</td>
                <td className="px-2 py-2">
                  {l.quantity} {l.unit}
                </td>
                <td className="px-4 py-2 text-right">{money(l.amountHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-[var(--cli-line)] px-4 py-3 text-right text-sm">
          <div>HT {money(q.amountHt)}</div>
          <div className="text-[var(--cli-muted)]">TVA {q.vatRate}%</div>
          <div className="text-lg font-bold">TTC {money(q.amountTtc)}</div>
        </div>
      </section>

      {q.status === 'sent' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cli-btn cli-btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/client-portal/quotes/${q.id}/accept`, {
                  method: 'POST',
                  body: '{}',
                });
                await load();
                router.refresh();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Accepter le devis
          </button>
          <button
            type="button"
            className="cli-btn cli-btn-ghost"
            disabled={busy}
            onClick={async () => {
              const reason = window.prompt('Motif du refus (optionnel)') || undefined;
              setBusy(true);
              try {
                await api(`/client-portal/quotes/${q.id}/refuse`, {
                  method: 'POST',
                  body: JSON.stringify({ reason }),
                });
                await load();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Refuser
          </button>
        </div>
      )}
    </div>
  );
}
