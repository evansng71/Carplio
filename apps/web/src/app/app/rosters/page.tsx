'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Roster = {
  id: string;
  code: string;
  name: string;
  cycleDays: number;
  pattern: string;
  slots: Array<{
    id: string;
    dayOffset: number;
    label: string;
    startTime: string;
    endTime: string;
    driver?: { employee: { firstName: string; lastName: string } };
    service?: { name: string };
  }>;
};

type Theo = {
  id: string;
  weekday?: number;
  notes?: string;
  driver?: { employee: { firstName: string; lastName: string } };
  vehicle?: { fleetNumber: string };
  service?: { name: string };
  course?: { code: string };
};

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [theo, setTheo] = useState<Theo[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; employee: { firstName: string; lastName: string } }>>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; fleetNumber: string }>>([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    code: 'ROL-NEW',
    name: 'Nouveau roulement',
    cycleDays: 14,
  });
  const [applyFrom, setApplyFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [theoForm, setTheoForm] = useState({
    driverId: '',
    vehicleId: '',
    serviceId: '',
    weekday: 1,
    notes: '',
  });

  const load = () => {
    api<Roster[]>('/rosters').then(setRosters);
    api<Theo[]>('/theoretical-assignments').then(setTheo);
    api('/drivers').then((d) => {
      setDrivers(d);
      if (d[0]) setTheoForm((f) => ({ ...f, driverId: f.driverId || d[0].id }));
    });
    api('/services').then((s) => {
      setServices(s);
      if (s[0]) setTheoForm((f) => ({ ...f, serviceId: f.serviceId || s[0].id }));
    });
    api('/vehicles').then((v) => {
      setVehicles(v);
      if (v[0]) setTheoForm((f) => ({ ...f, vehicleId: f.vehicleId || v[0].id }));
    });
  };

  useEffect(() => {
    load();
  }, []);

  async function createRoster(e: FormEvent) {
    e.preventDefault();
    await api('/rosters', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        slots: [0, 1, 2, 3, 4].map((dayOffset) => ({
          dayOffset,
          label: `Slot J${dayOffset}`,
          serviceId: services[0]?.id,
          driverId: drivers[0]?.id,
          startTime: '07:00',
          endTime: '09:30',
        })),
      }),
    });
    setMsg('Roulement créé');
    load();
  }

  async function apply(id: string, publish: boolean) {
    const r = await api<{ created: number }>(`/rosters/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ from: applyFrom, days: 7, publish }),
    });
    setMsg(`${r.created} occurrence(s) générée(s)${publish ? ' et publiées' : ''}`);
  }

  async function createTheo(e: FormEvent) {
    e.preventDefault();
    await api('/theoretical-assignments', {
      method: 'POST',
      body: JSON.stringify(theoForm),
    });
    setMsg('Préaffectation créée');
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roulements & préaffectations</h1>
        <p className="text-sm text-[var(--muted)]">
          Préaffectation théorique distincte de l’affectation publiée.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      <form onSubmit={createRoster} className="card grid gap-3 p-4 md:grid-cols-4">
        <div>
          <label className="label">Code</label>
          <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div>
          <label className="label">Nom</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Cycle (jours)</label>
          <input
            className="input"
            type="number"
            value={form.cycleDays}
            onChange={(e) => setForm({ ...form, cycleDays: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Créer roulement</button>
        </div>
      </form>

      <div className="flex items-end gap-3">
        <div>
          <label className="label">Appliquer à partir du</label>
          <input className="input" type="date" value={applyFrom} onChange={(e) => setApplyFrom(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        {rosters.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {r.code} — {r.name}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  Cycle {r.cycleDays}j · motif {r.pattern} · {r.slots.length} créneaux
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost border border-[var(--border)]" onClick={() => apply(r.id, false)}>
                  Générer brouillon 7j
                </button>
                <button className="btn-primary" onClick={() => apply(r.id, true)}>
                  Générer & publier
                </button>
              </div>
            </div>
            <div className="mt-3 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-1">Jour+</th>
                    <th>Label</th>
                    <th>Horaires</th>
                    <th>Conducteur</th>
                    <th>Service</th>
                  </tr>
                </thead>
                <tbody>
                  {r.slots.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--border)]">
                      <td className="py-1">{s.dayOffset}</td>
                      <td>{s.label}</td>
                      <td>
                        {s.startTime}–{s.endTime}
                      </td>
                      <td>
                        {s.driver
                          ? `${s.driver.employee.firstName} ${s.driver.employee.lastName}`
                          : '—'}
                      </td>
                      <td>{s.service?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Préaffectations théoriques</h2>
        <form onSubmit={createTheo} className="grid gap-3 md:grid-cols-5">
          <select
            className="input"
            value={theoForm.driverId}
            onChange={(e) => setTheoForm({ ...theoForm, driverId: e.target.value })}
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.employee.firstName} {d.employee.lastName}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={theoForm.vehicleId}
            onChange={(e) => setTheoForm({ ...theoForm, vehicleId: e.target.value })}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.fleetNumber}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={theoForm.serviceId}
            onChange={(e) => setTheoForm({ ...theoForm, serviceId: e.target.value })}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={theoForm.weekday}
            onChange={(e) => setTheoForm({ ...theoForm, weekday: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 0].map((w) => (
              <option key={w} value={w}>
                Jour {w}
              </option>
            ))}
          </select>
          <button className="btn-primary">Ajouter</button>
        </form>
        <ul className="space-y-2 text-sm">
          {theo.map((t) => (
            <li key={t.id} className="flex justify-between rounded-lg border border-[var(--border)] px-3 py-2">
              <span>
                {t.driver?.employee.firstName} {t.driver?.employee.lastName} ·{' '}
                {t.vehicle?.fleetNumber} · {t.service?.name || t.course?.code} · weekday{' '}
                {t.weekday}
              </span>
              <button
                className="text-danger"
                onClick={async () => {
                  await api(`/theoretical-assignments/${t.id}`, { method: 'DELETE' });
                  load();
                }}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
