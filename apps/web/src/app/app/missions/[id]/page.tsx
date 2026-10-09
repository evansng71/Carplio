'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

type Mission = {
  id: string;
  number: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  origin?: string;
  destination?: string;
  passengers: number;
  ticketReturnedAt?: string;
  order: { customer: { name: string } };
  assignments: Array<{
    id: string;
    published: boolean;
    driver?: { employee: { firstName: string; lastName: string } };
    vehicle?: { plate: string; fleetNumber: string };
  }>;
  documents: Array<{ id: string; fileName: string; kind: string }>;
};

type Driver = { id: string; employee: { firstName: string; lastName: string } };
type Vehicle = { id: string; fleetNumber: string; plate: string };

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [m, setM] = useState<Mission | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api<Mission>(`/missions/${id}`).then(setM);
  useEffect(() => {
    load();
    api<Driver[]>('/drivers').then((d) => {
      setDrivers(d);
      if (d[0]) setDriverId(d[0].id);
    });
    api<Vehicle[]>('/vehicles').then((v) => {
      setVehicles(v);
      if (v[0]) setVehicleId(v[0].id);
    });
  }, [id]);

  if (!m) return <p>Chargement…</p>;

  async function assign() {
    setMsg('');
    try {
      const a = await api<{ id: string }>('/planning/assignments', {
        method: 'POST',
        body: JSON.stringify({
          missionId: m!.id,
          driverId,
          vehicleId,
          startsAt: m!.startsAt,
          endsAt: m!.endsAt,
        }),
      });
      await api(`/planning/assignments/${a.id}/publish`, {
        method: 'POST',
        body: '{}',
      });
      setMsg('Affectation créée et publiée');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function pdf() {
    setMsg('');
    const doc = await api<{ id: string; fileName: string }>(
      `/documents/missions/${m!.id}/collective-ticket`,
      { method: 'POST', body: '{}' },
    );
    setMsg(`PDF généré : ${doc.fileName}`);
    load();
  }

  async function ticketReturn() {
    await api(`/missions/${m!.id}/ticket-return`, {
      method: 'POST',
      body: JSON.stringify({
        actualPassengers: m!.passengers,
        ticketNotes: 'Retour DEMO OK',
      }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {m.number} — {m.title}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {m.order.customer.name} · {m.status}
        </p>
      </div>
      <div className="card grid gap-2 p-4 text-sm md:grid-cols-2">
        <div>
          Départ : {new Date(m.startsAt).toLocaleString('fr-FR')}
        </div>
        <div>Fin : {new Date(m.endsAt).toLocaleString('fr-FR')}</div>
        <div>
          Trajet : {m.origin} → {m.destination}
        </div>
        <div>Voyageurs : {m.passengers}</div>
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Affectation</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="input"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.employee.firstName} {d.employee.lastName}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.fleetNumber} · {v.plate}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={assign}>
            Affecter & publier
          </button>
        </div>
        <ul className="text-sm">
          {m.assignments.map((a) => (
            <li key={a.id}>
              {a.driver
                ? `${a.driver.employee.firstName} ${a.driver.employee.lastName}`
                : '—'}{' '}
              / {a.vehicle?.fleetNumber} {a.vehicle?.plate} —{' '}
              {a.published ? 'publié' : 'brouillon'}
            </li>
          ))}
        </ul>
      </section>

      <section className="card flex flex-wrap gap-3 p-4">
        <button className="btn-primary" onClick={pdf}>
          Générer billet collectif PDF
        </button>
        <button className="btn-ghost border border-[var(--border)]" onClick={ticketReturn}>
          Enregistrer retour billet
        </button>
        {msg && <p className="w-full text-sm text-action">{msg}</p>}
        <ul className="w-full text-sm">
          {m.documents.map((d) => (
            <li key={d.id}>
              {d.kind} — {d.fileName}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
