'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { IconSteering, IconTile } from '@/components/Icons';
import {
  CommercialFilters,
  compareBy,
  matchSearch,
} from '@/components/CommercialFilters';
import { daysLeft, formatDate } from '@/lib/ops';

type Driver = {
  id: string;
  status: string;
  licenseNumber?: string | null;
  licenseCategories?: string | null;
  licenseExpiresAt?: string | null;
  cardExpiresAt?: string | null;
  fcoExpiresAt?: string | null;
  medicalExpiresAt?: string | null;
  employee: {
    firstName: string;
    lastName: string;
    matricule: string;
    accountLink?: { user: { status: string } } | null;
  };
  depot?: { name: string } | null;
};

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name_asc');

  useEffect(() => {
    api<Driver[]>('/drivers').then(setRows);
  }, []);

  const filtered = useMemo(() => {
    let list = rows.filter((d) => {
      if (status && d.status !== status) return false;
      return matchSearch(
        [
          d.employee.matricule,
          d.employee.firstName,
          d.employee.lastName,
          d.depot?.name,
          d.licenseNumber,
          d.licenseCategories,
        ],
        search,
      );
    });
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    list = [...list].sort((a, b) => {
      if (key === 'name')
        return compareBy(
          `${a.employee.lastName} ${a.employee.firstName}`,
          `${b.employee.lastName} ${b.employee.firstName}`,
          dir,
        );
      if (key === 'depot')
        return compareBy(a.depot?.name, b.depot?.name, dir);
      if (key === 'license')
        return compareBy(a.licenseExpiresAt, b.licenseExpiresAt, dir);
      return 0;
    });
    return list;
  }, [rows, search, status, sort]);

  function alertLabel(d: Driver) {
    const checks = [
      d.licenseExpiresAt,
      d.cardExpiresAt,
      d.fcoExpiresAt,
      d.medicalExpiresAt,
    ]
      .map(daysLeft)
      .filter((x): x is number => x != null);
    const worst = checks.sort((a, b) => a - b)[0];
    if (worst == null) return null;
    if (worst < 0)
      return (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
          Document expiré
        </span>
      );
    if (worst <= 30)
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
          Échéance {worst} j
        </span>
      );
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <IconTile tone="emerald">
          <IconSteering />
        </IconTile>
        <div>
          <p className="page-kicker">Module exploitation</p>
          <h1 className="text-2xl font-bold">Conducteurs</h1>
          <p className="text-sm text-[var(--muted)]">
            Habilitations, permis, carte chrono, FCO et visite médicale.
          </p>
        </div>
      </div>

      <CommercialFilters
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Nom, matricule, dépôt, permis…"
        filters={[
          {
            key: 'status',
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tous' },
              { value: 'active', label: 'Actif' },
              { value: 'inactive', label: 'Inactif' },
            ],
          },
        ]}
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'name_asc', label: 'Nom A→Z' },
          { value: 'depot_asc', label: 'Dépôt' },
          { value: 'license_asc', label: 'Permis (échéance)' },
        ]}
        resultCount={filtered.length}
        resultLabel="conducteur(s)"
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Matricule</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Dépôt</th>
              <th className="px-4 py-3 text-left">Permis</th>
              <th className="px-4 py-3 text-left">Accès portail</th>
              <th className="px-4 py-3 text-left">Alertes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{d.employee.matricule}</td>
                <td className="px-4 py-3">
                  <Link
                    className="font-semibold text-action"
                    href={`/app/drivers/${d.id}`}
                  >
                    {d.employee.firstName} {d.employee.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{d.depot?.name || '—'}</td>
                <td className="px-4 py-3">
                  <div>{d.licenseCategories || 'D'}</div>
                  <div className="text-xs text-[var(--muted)]">
                    exp. {formatDate(d.licenseExpiresAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {d.employee.accountLink?.user.status || 'non créé'}
                </td>
                <td className="px-4 py-3">{alertLabel(d) || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Aucun conducteur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
