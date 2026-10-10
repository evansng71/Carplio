'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { IconBus, IconPlus, IconTile } from '@/components/Icons';
import {
  CommercialFilters,
  compareBy,
  matchSearch,
} from '@/components/CommercialFilters';
import { daysLeft, formatDate, VEHICLE_STATUS } from '@/lib/ops';

type Vehicle = {
  id: string;
  fleetNumber: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  seats: number;
  status: string;
  energy?: string;
  hasPmr?: boolean;
  inspectionExpiresAt?: string | null;
  insuranceExpiresAt?: string | null;
  tachographExpiresAt?: string | null;
  depot?: { name: string } | null;
  category?: { name: string } | null;
};

export default function VehiclesPage() {
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('fleet_asc');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fleetNumber: '',
    plate: '',
    brand: '',
    model: '',
    seats: 53,
    energy: 'diesel',
  });

  const load = () => api<Vehicle[]>('/vehicles').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows.filter((v) => {
      if (status && v.status !== status) return false;
      return matchSearch(
        [
          v.fleetNumber,
          v.plate,
          v.brand,
          v.model,
          v.depot?.name,
          v.category?.name,
          VEHICLE_STATUS[v.status],
        ],
        search,
      );
    });
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    list = [...list].sort((a, b) => {
      if (key === 'fleet') return compareBy(a.fleetNumber, b.fleetNumber, dir);
      if (key === 'seats') return compareBy(a.seats, b.seats, dir);
      if (key === 'status') return compareBy(a.status, b.status, dir);
      return 0;
    });
    return list;
  }, [rows, search, status, sort]);

  async function create(e: FormEvent) {
    e.preventDefault();
    await api('/vehicles', { method: 'POST', body: JSON.stringify(form) });
    setForm({
      fleetNumber: '',
      plate: '',
      brand: '',
      model: '',
      seats: 53,
      energy: 'diesel',
    });
    setShowForm(false);
    load();
  }

  function complianceBadge(v: Vehicle) {
    const dates = [
      v.inspectionExpiresAt,
      v.insuranceExpiresAt,
      v.tachographExpiresAt,
    ];
    const worst = dates
      .map(daysLeft)
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b)[0];
    if (worst == null) return null;
    if (worst < 0)
      return (
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
          Échéance dépassée
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="teal">
            <IconBus />
          </IconTile>
          <div>
            <p className="page-kicker">Module exploitation</p>
            <h1 className="text-2xl font-bold">Parc véhicules</h1>
            <p className="text-sm text-[var(--muted)]">
              Flotte, capacité, options PMR et conformité (CT, assurance,
              chrono).
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          onClick={() => setShowForm((v) => !v)}
        >
          <IconPlus size={16} />
          Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card grid gap-3 p-4 md:grid-cols-6">
          {(
            [
              ['fleetNumber', 'N° parc'],
              ['plate', 'Immatriculation'],
              ['brand', 'Marque'],
              ['model', 'Modèle'],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                required={k === 'fleetNumber' || k === 'plate'}
              />
            </div>
          ))}
          <div>
            <label className="label">Places</label>
            <input
              className="input"
              type="number"
              min={1}
              value={form.seats}
              onChange={(e) =>
                setForm({ ...form, seats: Number(e.target.value) || 1 })
              }
            />
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full">Créer</button>
          </div>
        </form>
      )}

      <CommercialFilters
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Parc, immat., dépôt, catégorie…"
        filters={[
          {
            key: 'status',
            label: 'Statut',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tous' },
              ...Object.entries(VEHICLE_STATUS).map(([value, label]) => ({
                value,
                label,
              })),
            ],
          },
        ]}
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'fleet_asc', label: 'Parc A→Z' },
          { value: 'seats_desc', label: 'Places ↓' },
          { value: 'status_asc', label: 'Statut' },
        ]}
        resultCount={filtered.length}
        resultLabel="véhicule(s)"
      />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Parc</th>
              <th className="px-4 py-3 text-left">Immat.</th>
              <th className="px-4 py-3 text-left">Modèle</th>
              <th className="px-4 py-3 text-left">Places</th>
              <th className="px-4 py-3 text-left">Dépôt</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Conformité</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-semibold">
                  <Link className="text-action" href={`/app/vehicles/${v.id}`}>
                    {v.fleetNumber}
                  </Link>
                  {v.hasPmr && (
                    <span className="ml-2 text-[10px] font-medium text-teal-700">
                      PMR
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{v.plate}</td>
                <td className="px-4 py-3">
                  {[v.brand, v.model].filter(Boolean).join(' ') || '—'}
                  {v.category && (
                    <div className="text-xs text-[var(--muted)]">
                      {v.category.name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{v.seats}</td>
                <td className="px-4 py-3">{v.depot?.name || '—'}</td>
                <td className="px-4 py-3">
                  {VEHICLE_STATUS[v.status] || v.status}
                </td>
                <td className="px-4 py-3">
                  {complianceBadge(v) || (
                    <span className="text-xs text-[var(--muted)]">
                      CT {formatDate(v.inspectionExpiresAt)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Aucun véhicule.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
