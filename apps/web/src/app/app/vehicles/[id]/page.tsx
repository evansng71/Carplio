'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { IconBus, IconTile } from '@/components/Icons';
import {
  ENERGY_TYPES,
  formatDate,
  formatDateTime,
  VEHICLE_STATUS,
} from '@/lib/ops';

type VehicleDetail = {
  id: string;
  fleetNumber: string;
  plate: string;
  vin?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  seats: number;
  energy: string;
  status: string;
  odometerKm: number;
  inspectionExpiresAt?: string | null;
  insuranceExpiresAt?: string | null;
  tachographExpiresAt?: string | null;
  nextMaintenanceAt?: string | null;
  nextMaintenanceKm?: number | null;
  hasPmr: boolean;
  hasToilet: boolean;
  hasWifi: boolean;
  optionsNotes?: string | null;
  notes?: string | null;
  depotId?: string | null;
  categoryId?: string | null;
  depot?: { name: string } | null;
  category?: { name: string } | null;
  assignments: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    mission: { id: string; number: string; title: string };
    driver?: { employee: { firstName: string; lastName: string } } | null;
  }>;
  unavailabilities: Array<{
    id: string;
    kind: string;
    reason?: string | null;
    startsAt: string;
    endsAt: string;
  }>;
};

function toDate(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<VehicleDetail | null>(null);
  const [depots, setDepots] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>(
    {},
  );

  const load = useCallback(async () => {
    const data = await api<VehicleDetail>(`/vehicles/${id}`);
    setV(data);
    setForm({
      fleetNumber: data.fleetNumber,
      plate: data.plate,
      vin: data.vin || '',
      brand: data.brand || '',
      model: data.model || '',
      year: data.year || '',
      color: data.color || '',
      seats: data.seats,
      energy: data.energy,
      status: data.status,
      odometerKm: data.odometerKm,
      depotId: data.depotId || '',
      categoryId: data.categoryId || '',
      inspectionExpiresAt: toDate(data.inspectionExpiresAt),
      insuranceExpiresAt: toDate(data.insuranceExpiresAt),
      tachographExpiresAt: toDate(data.tachographExpiresAt),
      nextMaintenanceAt: toDate(data.nextMaintenanceAt),
      nextMaintenanceKm: data.nextMaintenanceKm ?? '',
      hasPmr: data.hasPmr,
      hasToilet: data.hasToilet,
      hasWifi: data.hasWifi,
      optionsNotes: data.optionsNotes || '',
      notes: data.notes || '',
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    api<{ id: string; name: string }[]>('/org/depots')
      .then(setDepots)
      .catch(() => undefined);
    api<{ id: string; name: string }[]>('/vehicle-categories')
      .then(setCategories)
      .catch(() => undefined);
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api(`/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          year: form.year === '' ? null : Number(form.year),
          seats: Number(form.seats),
          odometerKm: Number(form.odometerKm),
          nextMaintenanceKm:
            form.nextMaintenanceKm === ''
              ? null
              : Number(form.nextMaintenanceKm),
          depotId: form.depotId || null,
          categoryId: form.categoryId || null,
          inspectionExpiresAt: form.inspectionExpiresAt || null,
          insuranceExpiresAt: form.insuranceExpiresAt || null,
          tachographExpiresAt: form.tachographExpiresAt || null,
          nextMaintenanceAt: form.nextMaintenanceAt || null,
        }),
      });
      setMsg('Véhicule enregistré');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !v) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }
  if (!v) return <div className="text-sm text-[var(--muted)]">Chargement…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="teal">
            <IconBus />
          </IconTile>
          <div>
            <h1 className="text-2xl font-bold">
              {v.fleetNumber} · {v.plate}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {[v.brand, v.model].filter(Boolean).join(' ') || 'Véhicule'} ·{' '}
              {VEHICLE_STATUS[v.status] || v.status}
            </p>
          </div>
        </div>
        <Link href="/app/vehicles" className="btn-secondary">
          Retour
        </Link>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <section className="card grid gap-3 p-4 md:grid-cols-4">
          {(
            [
              ['fleetNumber', 'N° parc', 'text'],
              ['plate', 'Immatriculation', 'text'],
              ['vin', 'VIN', 'text'],
              ['brand', 'Marque', 'text'],
              ['model', 'Modèle', 'text'],
              ['year', 'Année', 'number'],
              ['color', 'Couleur', 'text'],
              ['seats', 'Places', 'number'],
              ['odometerKm', 'Kilométrage', 'number'],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                type={type}
                value={String(form[key] ?? '')}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [key]:
                      type === 'number'
                        ? e.target.value === ''
                          ? ''
                          : Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            </div>
          ))}
          <div>
            <label className="label">Énergie</label>
            <select
              className="input"
              value={String(form.energy)}
              onChange={(e) => setForm({ ...form, energy: e.target.value })}
            >
              {ENERGY_TYPES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select
              className="input"
              value={String(form.status)}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(VEHICLE_STATUS).map(([val, lab]) => (
                <option key={val} value={val}>
                  {lab}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Dépôt</label>
            <select
              className="input"
              value={String(form.depotId)}
              onChange={(e) => setForm({ ...form, depotId: e.target.value })}
            >
              <option value="">—</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select
              className="input"
              value={String(form.categoryId)}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="card grid gap-3 p-4 md:grid-cols-4">
          <div className="md:col-span-4 text-sm font-semibold">
            Conformité & entretien
          </div>
          {(
            [
              ['inspectionExpiresAt', 'Contrôle technique'],
              ['insuranceExpiresAt', 'Assurance'],
              ['tachographExpiresAt', 'Chronotachygraphe'],
              ['nextMaintenanceAt', 'Prochain entretien'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                type="date"
                value={String(form[key] || '')}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="label">Entretien à (km)</label>
            <input
              className="input"
              type="number"
              value={String(form.nextMaintenanceKm ?? '')}
              onChange={(e) =>
                setForm({
                  ...form,
                  nextMaintenanceKm:
                    e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>
        </section>

        <section className="card grid gap-3 p-4 md:grid-cols-3">
          <div className="md:col-span-3 text-sm font-semibold">Équipements</div>
          {(
            [
              ['hasPmr', 'Accès PMR'],
              ['hasToilet', 'Toilettes'],
              ['hasWifi', 'Wi‑Fi'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <div className="md:col-span-3">
            <label className="label">Options / notes équipements</label>
            <textarea
              className="input min-h-[72px]"
              value={String(form.optionsNotes || '')}
              onChange={(e) =>
                setForm({ ...form, optionsNotes: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-3">
            <label className="label">Notes internes</label>
            <textarea
              className="input min-h-[72px]"
              value={String(form.notes || '')}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </section>

        <button className="btn-primary" disabled={busy}>
          Enregistrer
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Affectations récentes
          </div>
          <table className="w-full text-sm">
            <tbody>
              {v.assignments.map((a) => (
                <tr key={a.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link
                      className="text-action font-medium"
                      href={`/app/missions/${a.mission.id}`}
                    >
                      {a.mission.number}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">
                      {formatDateTime(a.startsAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {a.driver
                      ? `${a.driver.employee.firstName} ${a.driver.employee.lastName}`
                      : '—'}
                  </td>
                </tr>
              ))}
              {v.assignments.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-[var(--muted)]">
                    Aucune affectation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Indisponibilités
          </div>
          <table className="w-full text-sm">
            <tbody>
              {v.unavailabilities.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.kind}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {u.reason || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {formatDate(u.startsAt)} → {formatDate(u.endsAt)}
                  </td>
                </tr>
              ))}
              {v.unavailabilities.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-[var(--muted)]">
                    Aucune indisponibilité
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
