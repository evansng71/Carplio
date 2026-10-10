'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AccessTab } from '@/components/AccessTab';
import { IconSteering, IconTile } from '@/components/Icons';
import { formatDate, formatDateTime } from '@/lib/ops';

type DriverDetail = {
  id: string;
  status: string;
  depotId?: string | null;
  licenseNumber?: string | null;
  licenseCategories?: string | null;
  licenseExpiresAt?: string | null;
  cardExpiresAt?: string | null;
  fcoExpiresAt?: string | null;
  medicalExpiresAt?: string | null;
  adrExpiresAt?: string | null;
  qualifications?: string | null;
  maxDailyHours?: number | null;
  preferredNotes?: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string;
    email?: string | null;
  };
  depot?: { name: string } | null;
  rests: Array<{ kind: string; startsAt: string; endsAt: string }>;
  assignments?: Array<{
    id: string;
    startsAt: string;
    mission: { id: string; number: string; title: string };
    vehicle?: { fleetNumber: string; plate: string } | null;
  }>;
};

function toDate(iso?: string | null) {
  return iso ? iso.slice(0, 10) : '';
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'info' | 'access'>('info');
  const [d, setD] = useState<DriverDetail | null>(null);
  const [depots, setDepots] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    depotId: '',
    licenseNumber: '',
    licenseCategories: 'D',
    licenseExpiresAt: '',
    cardExpiresAt: '',
    fcoExpiresAt: '',
    medicalExpiresAt: '',
    adrExpiresAt: '',
    qualifications: '',
    maxDailyHours: 9,
    preferredNotes: '',
    status: 'active',
  });

  const load = useCallback(async () => {
    const data = await api<DriverDetail>(`/drivers/${id}`);
    setD(data);
    setForm({
      depotId: data.depotId || '',
      licenseNumber: data.licenseNumber || '',
      licenseCategories: data.licenseCategories || 'D',
      licenseExpiresAt: toDate(data.licenseExpiresAt),
      cardExpiresAt: toDate(data.cardExpiresAt),
      fcoExpiresAt: toDate(data.fcoExpiresAt),
      medicalExpiresAt: toDate(data.medicalExpiresAt),
      adrExpiresAt: toDate(data.adrExpiresAt),
      qualifications: data.qualifications || '',
      maxDailyHours: data.maxDailyHours ?? 9,
      preferredNotes: data.preferredNotes || '',
      status: data.status || 'active',
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    api<{ id: string; name: string }[]>('/org/depots')
      .then(setDepots)
      .catch(() => undefined);
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api(`/drivers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          depotId: form.depotId || null,
          licenseExpiresAt: form.licenseExpiresAt || null,
          cardExpiresAt: form.cardExpiresAt || null,
          fcoExpiresAt: form.fcoExpiresAt || null,
          medicalExpiresAt: form.medicalExpiresAt || null,
          adrExpiresAt: form.adrExpiresAt || null,
        }),
      });
      setMsg('Fiche conducteur enregistrée');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !d) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }
  if (!d) return <p className="text-sm text-[var(--muted)]">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="emerald">
            <IconSteering />
          </IconTile>
          <div>
            <h1 className="text-2xl font-bold">
              {d.employee.firstName} {d.employee.lastName}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {d.employee.matricule} · {d.employee.email || '—'} ·{' '}
              {d.depot?.name || 'Sans dépôt'}
            </p>
          </div>
        </div>
        <Link href="/app/drivers" className="btn-secondary">
          Retour
        </Link>
      </div>

      <div className="flex gap-2">
        <button
          className={tab === 'info' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('info')}
        >
          Fiche & conformité
        </button>
        <button
          className={tab === 'access' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('access')}
        >
          Accès logiciel & portail
        </button>
      </div>

      {(msg || err) && tab === 'info' && (
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

      {tab === 'info' ? (
        <div className="space-y-4">
          <form onSubmit={save} className="card grid gap-3 p-4 md:grid-cols-3">
            <div>
              <label className="label">Dépôt</label>
              <select
                className="input"
                value={form.depotId}
                onChange={(e) => setForm({ ...form, depotId: e.target.value })}
              >
                <option value="">—</option>
                {depots.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
            <div>
              <label className="label">Heures max / jour</label>
              <input
                className="input"
                type="number"
                min={1}
                max={15}
                step={0.5}
                value={form.maxDailyHours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxDailyHours: Number(e.target.value) || 9,
                  })
                }
              />
            </div>
            <div>
              <label className="label">N° permis</label>
              <input
                className="input"
                value={form.licenseNumber}
                onChange={(e) =>
                  setForm({ ...form, licenseNumber: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Catégories</label>
              <input
                className="input"
                value={form.licenseCategories}
                onChange={(e) =>
                  setForm({ ...form, licenseCategories: e.target.value })
                }
                placeholder="D, DE…"
              />
            </div>
            {(
              [
                ['licenseExpiresAt', 'Expiration permis'],
                ['cardExpiresAt', 'Carte chronotachygraphe'],
                ['fcoExpiresAt', 'FCO'],
                ['medicalExpiresAt', 'Visite médicale'],
                ['adrExpiresAt', 'ADR (si applicable)'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input
                  className="input"
                  type="date"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="md:col-span-3">
              <label className="label">Qualifications / habilitations</label>
              <textarea
                className="input min-h-[72px]"
                value={form.qualifications}
                onChange={(e) =>
                  setForm({ ...form, qualifications: e.target.value })
                }
                placeholder="Scolaire, montagne, grand tourisme…"
              />
            </div>
            <div className="md:col-span-3">
              <label className="label">Préférences / notes</label>
              <textarea
                className="input min-h-[72px]"
                value={form.preferredNotes}
                onChange={(e) =>
                  setForm({ ...form, preferredNotes: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-3">
              <button className="btn-primary" disabled={busy}>
                Enregistrer
              </button>
            </div>
          </form>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <div className="mb-2 font-semibold">Repos programmés</div>
              <ul className="space-y-1 text-sm">
                {d.rests.map((r, i) => (
                  <li key={i}>
                    {r.kind} — {formatDate(r.startsAt)} → {formatDate(r.endsAt)}
                  </li>
                ))}
                {d.rests.length === 0 && (
                  <li className="text-[var(--muted)]">Aucun repos planifié</li>
                )}
              </ul>
            </section>
            <section className="card overflow-hidden">
              <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
                Prochaines missions
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {(d.assignments || []).slice(0, 10).map((a) => (
                    <tr key={a.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <Link
                          className="font-medium text-action"
                          href={`/app/missions/${a.mission.id}`}
                        >
                          {a.mission.number}
                        </Link>
                        <div className="text-xs text-[var(--muted)]">
                          {formatDateTime(a.startsAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        {a.vehicle
                          ? `${a.vehicle.fleetNumber} · ${a.vehicle.plate}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {(d.assignments || []).length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-[var(--muted)]">
                        Aucune affectation
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      ) : (
        <AccessTab employeeId={d.employee.id} />
      )}
    </div>
  );
}
