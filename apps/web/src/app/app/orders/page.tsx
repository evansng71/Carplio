'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { IconClipboard, IconTile } from '@/components/Icons';
import {
  CommercialFilters,
  compareBy,
  matchSearch,
} from '@/components/CommercialFilters';
import { ORDER_STATUS } from '@/lib/commercial';
import { formatMoney } from '@/lib/billing';

export default function OrdersPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      number: string;
      title: string;
      status: string;
      createdAt?: string;
      amountTtc?: number;
      customerPoNumber?: string | null;
      departureAt?: string | null;
      customer: { name: string };
      missions: Array<{ id: string; number: string }>;
      quote?: { number?: string } | null;
    }>
  >([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('number_desc');

  useEffect(() => {
    api('/orders').then(setRows);
  }, []);

  const filtered = useMemo(() => {
    let list = rows.filter((o) => {
      if (status && o.status !== status) return false;
      return matchSearch(
        [
          o.number,
          o.title,
          o.customer.name,
          o.quote?.number,
          o.customerPoNumber,
          ...o.missions.map((m) => m.number),
          ORDER_STATUS[o.status],
        ],
        search,
      );
    });
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    list = [...list].sort((a, b) => {
      if (key === 'number') return compareBy(a.number, b.number, dir);
      if (key === 'client') return compareBy(a.customer.name, b.customer.name, dir);
      if (key === 'status') return compareBy(a.status, b.status, dir);
      if (key === 'date') return compareBy(a.createdAt, b.createdAt, dir);
      return 0;
    });
    return list;
  }, [rows, search, status, sort]);

  const statusOptions = useMemo(() => {
    const keys = Array.from(new Set(rows.map((r) => r.status)));
    return [
      { value: '', label: 'Tous' },
      ...keys.map((k) => ({ value: k, label: ORDER_STATUS[k] || k })),
    ];
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <IconTile tone="orange">
          <IconClipboard />
        </IconTile>
        <div>
          <p className="page-kicker">Module commercial</p>
          <h1 className="text-2xl font-bold">Commandes</h1>
          <p className="text-sm text-[var(--muted)]">
            Commandes issues des devis acceptés et missions associées.
          </p>
        </div>
      </div>

      <CommercialFilters
        search={search}
        onSearch={setSearch}
        searchPlaceholder="N°, client, titre, BC, mission…"
        filters={[
          {
            key: 'status',
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: statusOptions,
          },
        ]}
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'number_desc', label: 'N° ↓' },
          { value: 'number_asc', label: 'N° ↑' },
          { value: 'client_asc', label: 'Client A→Z' },
          { value: 'status_asc', label: 'Statut' },
          { value: 'date_desc', label: 'Date ↓' },
        ]}
        resultCount={filtered.length}
        resultLabel="commande(s)"
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">N°</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Titre</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-right">TTC</th>
              <th className="px-4 py-3 text-left">Missions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Aucune commande pour ces critères.
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-semibold">
                  <Link className="text-action" href={`/app/orders/${o.id}`}>
                    {o.number}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.customer.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  <Link href={`/app/orders/${o.id}`}>{o.title}</Link>
                  {o.customerPoNumber && (
                    <div className="text-xs">BC {o.customerPoNumber}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {ORDER_STATUS[o.status] || o.status}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(o.amountTtc || 0)}
                </td>
                <td className="px-4 py-3">
                  {o.missions.map((m) => (
                    <Link
                      key={m.id}
                      className="mr-2 text-action"
                      href={`/app/missions/${m.id}`}
                    >
                      {m.number}
                    </Link>
                  ))}
                  {o.missions.length === 0 && '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
