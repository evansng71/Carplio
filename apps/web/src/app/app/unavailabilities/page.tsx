'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function UnavailabilitiesPage() {
  const [data, setData] = useState<{
    drivers: Array<{
      id: string;
      kind: string;
      reason?: string;
      startsAt: string;
      endsAt: string;
      driver: { employee: { firstName: string; lastName: string } };
    }>;
    vehicles: Array<{
      id: string;
      kind: string;
      reason?: string;
      startsAt: string;
      endsAt: string;
      vehicle: { fleetNumber: string; plate: string };
    }>;
  } | null>(null);
  const [drivers, setDrivers] = useState<Array<{ id: string; employee: { firstName: string; lastName: string } }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; fleetNumber: string }>>([]);
  const [form, setForm] = useState({
    type: 'driver' as 'driver' | 'vehicle',
    resourceId: '',
    kind: 'absence',
    reason: '',
    startsAt: '',
    endsAt: '',
  });
  const [impact, setImpact] = useState('');

  const load = () => api('/unavailabilities').then(setData);
  useEffect(() => {
    load();
    api('/drivers').then((d) => {
      setDrivers(d);
      if (d[0]) setForm((f) => ({ ...f, resourceId: d[0].id }));
    });
    api('/vehicles').then(setVehicles);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const path =
      form.type === 'driver'
        ? '/unavailabilities/driver'
        : '/unavailabilities/vehicle';
    const body =
      form.type === 'driver'
        ? {
            driverId: form.resourceId,
            kind: form.kind,
            reason: form.reason,
            startsAt: form.startsAt,
            endsAt: form.endsAt,
          }
        : {
            vehicleId: form.resourceId,
            kind: form.kind,
            reason: form.reason,
            startsAt: form.startsAt,
            endsAt: form.endsAt,
          };
    const r = await api<{ impacted: unknown[] }>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setImpact(`${r.impacted?.length || 0} affectation(s) impactée(s) — alerte créée`);
    load();
  }

  if (!data) return <p>Chargement…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Indisponibilités</h1>
        <p className="text-sm text-[var(--muted)]">
          Posez absences / immobilisations — les missions touchées sont signalées.
        </p>
      </div>

      <form onSubmit={submit} className="card grid gap-3 p-4 md:grid-cols-3">
        <div>
          <label className="label">Type</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as 'driver' | 'vehicle';
              setForm({
                ...form,
                type,
                resourceId:
                  type === 'driver' ? drivers[0]?.id || '' : vehicles[0]?.id || '',
                kind: type === 'driver' ? 'absence' : 'maintenance',
              });
            }}
          >
            <option value="driver">Conducteur</option>
            <option value="vehicle">Véhicule</option>
          </select>
        </div>
        <div>
          <label className="label">Ressource</label>
          <select
            className="input"
            value={form.resourceId}
            onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
          >
            {form.type === 'driver'
              ? drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.employee.firstName} {d.employee.lastName}
                  </option>
                ))
              : vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.fleetNumber}
                  </option>
                ))}
          </select>
        </div>
        <div>
          <label className="label">Motif</label>
          <input
            className="input"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Début</label>
          <input
            className="input"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Fin</label>
          <input
            className="input"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            required
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Enregistrer</button>
        </div>
      </form>
      {impact && <p className="text-sm text-warn">{impact}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Conducteurs</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.drivers.map((u) => (
              <li key={u.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                <strong>
                  {u.driver.employee.firstName} {u.driver.employee.lastName}
                </strong>{' '}
                — {u.kind}
                <div className="text-[var(--muted)]">
                  {new Date(u.startsAt).toLocaleString('fr-FR')} →{' '}
                  {new Date(u.endsAt).toLocaleString('fr-FR')}
                </div>
                <div>{u.reason}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Véhicules</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.vehicles.map((u) => (
              <li key={u.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                <strong>
                  {u.vehicle.fleetNumber} · {u.vehicle.plate}
                </strong>{' '}
                — {u.kind}
                <div className="text-[var(--muted)]">
                  {new Date(u.startsAt).toLocaleString('fr-FR')} →{' '}
                  {new Date(u.endsAt).toLocaleString('fr-FR')}
                </div>
              </li>
            ))}
            {data.vehicles.length === 0 && (
              <li className="text-[var(--muted)]">Aucune sur la période.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
