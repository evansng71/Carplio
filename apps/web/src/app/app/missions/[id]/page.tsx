'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, openPrintHtml } from '@/lib/api';
import { IconRoute, IconTile } from '@/components/Icons';
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
  originAddress?: string | null;
  destinationAddress?: string | null;
  passengers: number;
  minSeats?: number | null;
  requiresPmr?: boolean;
  estimatedKm?: number | null;
  hlpKm?: number | null;
  opsNotes?: string | null;
  clientBrief?: string | null;
  roadSheetNotes?: string | null;
  ticketReturnedAt?: string | null;
  actualPassengers?: number | null;
  order: {
    id: string;
    number?: string;
    customer: { id?: string; name: string };
    quote?: { id: string; number: string } | null;
  };
  assignments: Array<{
    id: string;
    published: boolean;
    driver?: { employee: { firstName: string; lastName: string } };
    vehicle?: { plate: string; fleetNumber: string; seats?: number };
  }>;
  documents: Array<{ id: string; fileName: string; kind: string }>;
};

type Driver = { id: string; employee: { firstName: string; lastName: string } };
type Vehicle = {
  id: string;
  fleetNumber: string;
  plate: string;
  seats: number;
  hasPmr?: boolean;
  status?: string;
};

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [m, setM] = useState<Mission | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    status: '',
    passengers: 0,
    minSeats: 0,
    requiresPmr: false,
    estimatedKm: '',
    hlpKm: '',
    opsNotes: '',
    clientBrief: '',
    roadSheetNotes: '',
    origin: '',
    destination: '',
  });

  const load = useCallback(async () => {
    const data = await api<Mission>(`/missions/${id}`);
    setM(data);
    setForm({
      status: data.status,
      passengers: data.passengers,
      minSeats: data.minSeats || data.passengers,
      requiresPmr: !!data.requiresPmr,
      estimatedKm: data.estimatedKm != null ? String(data.estimatedKm) : '',
      hlpKm: data.hlpKm != null ? String(data.hlpKm) : '',
      opsNotes: data.opsNotes || '',
      clientBrief: data.clientBrief || '',
      roadSheetNotes: data.roadSheetNotes || '',
      origin: data.origin || '',
      destination: data.destination || '',
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    api<Driver[]>('/drivers').then((d) => {
      setDrivers(d);
      if (d[0]) setDriverId(d[0].id);
    });
    api<Vehicle[]>('/vehicles').then((v) => {
      setVehicles(v);
      if (v[0]) setVehicleId(v[0].id);
    });
  }, [load]);

  if (!m && !err) return <p className="text-sm text-[var(--muted)]">Chargement…</p>;
  if (!m) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }

  async function saveOps(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api(`/missions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: form.status,
          passengers: Number(form.passengers),
          minSeats: Number(form.minSeats) || null,
          requiresPmr: form.requiresPmr,
          estimatedKm: form.estimatedKm === '' ? null : Number(form.estimatedKm),
          hlpKm: form.hlpKm === '' ? null : Number(form.hlpKm),
          opsNotes: form.opsNotes || null,
          clientBrief: form.clientBrief || null,
          roadSheetNotes: form.roadSheetNotes || null,
          origin: form.origin || null,
          destination: form.destination || null,
        }),
      });
      setMsg('Mission enregistrée');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    setMsg('');
    setErr('');
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
      setErr(e instanceof Error ? e.message : 'Erreur');
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
        actualPassengers: form.passengers || m!.passengers,
        ticketNotes: form.roadSheetNotes || 'Retour billet',
      }),
    });
    setMsg('Retour billet enregistré');
    load();
  }

  const suitableVehicles = vehicles.filter(
    (v) =>
      v.seats >= (form.minSeats || form.passengers || 0) &&
      (!form.requiresPmr || v.hasPmr),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="violet">
            <IconRoute />
          </IconTile>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{m.number}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${missionStatusTone(m.status)}`}
              >
                {MISSION_STATUS[m.status] || m.status}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">{m.title}</p>
            <p className="mt-1 text-sm">
              Client {m.order.customer.name}
              {m.order.quote && (
                <>
                  {' '}
                  · Devis{' '}
                  <Link
                    className="text-action"
                    href={`/app/quotes/${m.order.quote.id}`}
                  >
                    {m.order.quote.number}
                  </Link>
                </>
              )}
              {' '}
              · Commande{' '}
              <Link className="text-action" href={`/app/orders/${m.order.id}`}>
                {m.order.number || 'voir'}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/app/planning" className="btn-secondary">
            Planning
          </Link>
          <Link href="/app/missions" className="btn-secondary">
            Liste
          </Link>
        </div>
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

      <div className="card grid gap-2 p-4 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs text-[var(--muted)]">Départ</div>
          <div className="font-medium">{formatDateTime(m.startsAt)}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Fin</div>
          <div className="font-medium">{formatDateTime(m.endsAt)}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Trajet</div>
          <div className="font-medium">
            {m.origin} → {m.destination}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Voyageurs</div>
          <div className="font-medium">
            {m.passengers}
            {m.requiresPmr ? ' · PMR' : ''}
          </div>
        </div>
      </div>

      <form onSubmit={saveOps} className="card grid gap-3 p-4 md:grid-cols-3">
        <div className="md:col-span-3 text-sm font-semibold">
          Données exploitation
        </div>
        <div>
          <label className="label">Statut</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {Object.entries(MISSION_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Passagers</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.passengers}
            onChange={(e) =>
              setForm({ ...form, passengers: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="label">Places mini</label>
          <input
            className="input"
            type="number"
            min={0}
            value={form.minSeats}
            onChange={(e) =>
              setForm({ ...form, minSeats: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="label">Origine</label>
          <input
            className="input"
            value={form.origin}
            onChange={(e) => setForm({ ...form, origin: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Destination</label>
          <input
            className="input"
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresPmr}
              onChange={(e) =>
                setForm({ ...form, requiresPmr: e.target.checked })
              }
            />
            Accès PMR requis
          </label>
        </div>
        <div>
          <label className="label">Km estimés</label>
          <input
            className="input"
            type="number"
            value={form.estimatedKm}
            onChange={(e) => setForm({ ...form, estimatedKm: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Km HLP</label>
          <input
            className="input"
            type="number"
            value={form.hlpKm}
            onChange={(e) => setForm({ ...form, hlpKm: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Brief client</label>
          <textarea
            className="input min-h-[64px]"
            value={form.clientBrief}
            onChange={(e) => setForm({ ...form, clientBrief: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Notes exploitation</label>
          <textarea
            className="input min-h-[64px]"
            value={form.opsNotes}
            onChange={(e) => setForm({ ...form, opsNotes: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Feuille de route / consignes</label>
          <textarea
            className="input min-h-[64px]"
            value={form.roadSheetNotes}
            onChange={(e) =>
              setForm({ ...form, roadSheetNotes: e.target.value })
            }
          />
        </div>
        <div className="md:col-span-3">
          <button className="btn-primary" disabled={busy}>
            Enregistrer
          </button>
        </div>
      </form>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Affectation équipage</h2>
        <p className="text-xs text-[var(--muted)]">
          Contrôles : disponibilité, capacité places
          {form.requiresPmr ? ', PMR' : ''}, permis / CT non expirés.
        </p>
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
            {(suitableVehicles.length ? suitableVehicles : vehicles).map(
              (v) => (
                <option key={v.id} value={v.id}>
                  {v.fleetNumber} · {v.plate} · {v.seats} pl.
                  {v.hasPmr ? ' · PMR' : ''}
                </option>
              ),
            )}
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
              / {a.vehicle?.fleetNumber} {a.vehicle?.plate}
              {a.vehicle?.seats != null ? ` (${a.vehicle.seats} pl.)` : ''} —{' '}
              {a.published ? 'publié' : 'brouillon'}
            </li>
          ))}
          {m.assignments.length === 0 && (
            <li className="text-[var(--muted)]">Aucune affectation</li>
          )}
        </ul>
      </section>

      <section className="card flex flex-wrap gap-3 p-4">
        <button
          className="btn-primary"
          onClick={() =>
            openPrintHtml(`/documents/print/mission/${m.id}/ticket`).catch(
              (e) => setMsg(e.message),
            )
          }
        >
          Imprimer billet
        </button>
        <button
          className="btn-secondary"
          onClick={pdf}
        >
          Générer PDF fichier
        </button>
        <button className="btn-secondary" onClick={ticketReturn}>
          Enregistrer retour billet
        </button>
        {m.status === 'done' || m.status === 'ops_return_review' ? (
          <Link href="/app/billing" className="btn-secondary">
            Facturer
          </Link>
        ) : null}
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
