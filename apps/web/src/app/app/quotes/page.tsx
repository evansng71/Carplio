'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { IconFile, IconPlus, IconTile } from '@/components/Icons';
import {
  CommercialFilters,
  compareBy,
  matchSearch,
} from '@/components/CommercialFilters';
import {
  formatDateFr,
  formatMoney,
  QuoteDetail,
  QUOTE_STATUS_LABELS,
} from '@/lib/quote';
import { SERVICE_TYPES } from '@/lib/commercial';

function statusTone(status: string) {
  if (status === 'draft') return 'bg-slate-100 text-slate-700';
  if (status === 'sent') return 'bg-sky-100 text-sky-800';
  if (status === 'accepted' || status === 'planning')
    return 'bg-emerald-100 text-emerald-800';
  if (status === 'invoicing') return 'bg-amber-100 text-amber-900';
  if (status === 'refused' || status === 'trashed')
    return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteDetail[]>([]);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [sort, setSort] = useState('date_desc');

  useEffect(() => {
    api<QuoteDetail[]>('/quotes')
      .then(setQuotes)
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    let rows = quotes.filter((q) => {
      if (status && q.status !== status) return false;
      if (serviceType && q.serviceType !== serviceType) return false;
      return matchSearch(
        [
          q.number,
          q.title,
          q.customer?.name,
          q.origin,
          q.destination,
          q.salesperson?.displayName,
          q.customerPoNumber,
          q.serviceType,
          QUOTE_STATUS_LABELS[q.status],
        ],
        search,
      );
    });
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    rows = [...rows].sort((a, b) => {
      if (key === 'date')
        return compareBy(a.departureAt || a.createdAt, b.departureAt || b.createdAt, dir);
      if (key === 'amount')
        return compareBy(
          a.proposedPriceHt || a.amountHt,
          b.proposedPriceHt || b.amountHt,
          dir,
        );
      if (key === 'client')
        return compareBy(a.customer?.name, b.customer?.name, dir);
      if (key === 'number') return compareBy(a.number, b.number, dir);
      return 0;
    });
    return rows;
  }, [quotes, search, status, serviceType, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="blue">
            <IconFile />
          </IconTile>
          <div>
            <p className="page-kicker">Module commercial</p>
            <h1 className="text-2xl font-bold">Devis</h1>
            <p className="text-sm text-[var(--muted)]">
              Création, proposition et suivi commercial des devis.
            </p>
          </div>
        </div>
        <Link
          href="/app/quotes/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          <IconPlus size={16} />
          Nouveau devis
        </Link>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </div>
      )}

      <CommercialFilters
        search={search}
        onSearch={setSearch}
        searchPlaceholder="N°, client, trajet, BC, commercial…"
        filters={[
          {
            key: 'status',
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tous' },
              ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
          {
            key: 'serviceType',
            label: 'Prestation',
            value: serviceType,
            onChange: setServiceType,
            options: [
              { value: '', label: 'Toutes' },
              ...SERVICE_TYPES.map((s) => ({
                value: s.value,
                label: s.label,
              })),
            ],
          },
        ]}
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'date_desc', label: 'Départ / date ↓' },
          { value: 'date_asc', label: 'Départ / date ↑' },
          { value: 'amount_desc', label: 'Montant ↓' },
          { value: 'amount_asc', label: 'Montant ↑' },
          { value: 'client_asc', label: 'Client A→Z' },
          { value: 'number_asc', label: 'N°' },
        ]}
        resultCount={filtered.length}
        resultLabel="devis"
      />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Trajet</th>
              <th className="px-4 py-3 font-medium">Départ</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Aucun devis pour ces critères.
                </td>
              </tr>
            )}
            {filtered.map((q) => (
              <tr
                key={q.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/60"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/app/quotes/${q.id}`}
                    className="font-semibold text-action hover:underline"
                  >
                    {q.number}
                  </Link>
                </td>
                <td className="px-4 py-3">{q.customer?.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {[q.origin, q.destination].filter(Boolean).join(' → ') ||
                    q.title}
                </td>
                <td className="px-4 py-3">{formatDateFr(q.departureAt)}</td>
                <td className="px-4 py-3 font-medium">
                  {formatMoney(q.proposedPriceHt || q.amountHt)} HT
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone(q.status)}`}
                  >
                    {QUOTE_STATUS_LABELS[q.status] || q.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
