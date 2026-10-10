'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { IconRoute, IconTile } from '@/components/Icons';
import {
  CommercialFilters,
  compareBy,
  matchSearch,
} from '@/components/CommercialFilters';
import {
  formatDateTime,
  missionStatusTone,
  MISSION_STATUS,
} from '@/lib/ops';

type Mission = {
  id: string;
  number: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  origin?: string | null;
  destination?: string | null;
  passengers: number;
  requiresPmr?: boolean;
  order?: { customer?: { name: string }; number?: string } | null;
  assignments: Array<{
    id: string;
    driver?: { employee: { firstName: string; lastName: string } } | null;
    vehicle?: { fleetNumber: string; plate: string } | null;
  }>;
  documents: unknown[];
};

export default function MissionsPage() {
  const [rows, setRows] = useState<Mission[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [assigned, setAssigned] = useState('');
  const [sort, setSort] = useState('date_asc');

  useEffect(() => {
    api<Mission[]>('/missions').then(setRows);
  }, []);

  const filtered = useMemo(() => {
    let list = rows.filter((m) => {
      if (status && m.status !== status) return false;
      if (assigned === 'yes' && m.assignments.length === 0) return false;
      if (assigned === 'no' && m.assignments.length > 0) return false;
      const a = m.assignments[0];
      return matchSearch(
        [
          m.number,
          m.title,
          m.origin,
          m.destination,
          m.order?.customer?.name,
          m.order?.number,
          a?.driver
            ? `${a.driver.employee.firstName} ${a.driver.employee.lastName}`
            : '',
          a?.vehicle?.fleetNumber,
          a?.vehicle?.plate,
          MISSION_STATUS[m.status],
        ],
        search,
      );
    });
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    list = [...list].sort((a, b) => {
      if (key === 'date') return compareBy(a.startsAt, b.startsAt, dir);
      if (key === 'number') return compareBy(a.number, b.number, dir);
      if (key === 'status') return compareBy(a.status, b.status, dir);
      if (key === 'client')
        return compareBy(a.order?.customer?.name, b.order?.customer?.name, dir);
      return 0;
    });
    return list;
  }, [rows, search, status, assigned, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="violet">
            <IconRoute />
          </IconTile>
          <div>
            <p className="page-kicker">Module exploitation</p>
            <h1 className="text-2xl font-bold">Missions</h1>
            <p className="text-sm text-[var(--muted)]">
              Issues des commandes commerciales — affectation, publication et
              retour billet.
            </p>
          </div>
        </div>
        <Link href="/app/ops" className="btn-secondary">
          Cockpit exploitation
        </Link>
      </div>

      <CommercialFilters
        search={search}
        onSearch={setSearch}
        searchPlaceholder="N°, client, trajet, conducteur, véhicule…"
        filters={[
          {
            key: 'status',
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tous' },
              ...Object.entries(MISSION_STATUS).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
          {
            key: 'assigned',
            label: 'Affectation',
            value: assigned,
            onChange: setAssigned,
            options: [
              { value: '', label: 'Toutes' },
              { value: 'yes', label: 'Affectées' },
              { value: 'no', label: 'Non affectées' },
            ],
          },
        ]}
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'date_asc', label: 'Départ ↑' },
          { value: 'date_desc', label: 'Départ ↓' },
          { value: 'number_asc', label: 'N°' },
          { value: 'client_asc', label: 'Client' },
          { value: 'status_asc', label: 'Statut' },
        ]}
        resultCount={filtered.length}
        resultLabel="mission(s)"
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">N°</th>
              <th className="px-4 py-3 text-left">Client / titre</th>
              <th className="px-4 py-3 text-left">Horaires</th>
              <th className="px-4 py-3 text-left">Équipage</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const a = m.assignments[0];
              return (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-semibold">
                    <Link className="text-action" href={`/app/missions/${m.id}`}>
                      {m.number}
                    </Link>
                    {m.requiresPmr && (
                      <div className="text-[10px] font-medium text-teal-700">
                        PMR
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {m.order?.customer?.name || '—'}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{m.title}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {m.origin} → {m.destination} · {m.passengers} pax
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{formatDateTime(m.startsAt)}</div>
                    <div className="text-[var(--muted)]">
                      → {formatDateTime(m.endsAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a?.driver
                      ? `${a.driver.employee.firstName} ${a.driver.employee.lastName}`
                      : '—'}
                    <div className="text-[var(--muted)]">
                      {a?.vehicle
                        ? `${a.vehicle.fleetNumber} · ${a.vehicle.plate}`
                        : 'Sans véhicule'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${missionStatusTone(m.status)}`}
                    >
                      {MISSION_STATUS[m.status] || m.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Aucune mission pour ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
