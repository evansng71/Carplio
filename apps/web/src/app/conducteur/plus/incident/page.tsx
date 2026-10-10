'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';

const CATEGORIES = [
  { value: 'retard', label: 'Retard' },
  { value: 'panne', label: 'Panne véhicule' },
  { value: 'accident', label: 'Accident / accrochage' },
  { value: 'voyageur', label: 'Incident voyageur' },
  { value: 'route', label: 'Problème de route' },
  { value: 'autre', label: 'Autre' },
];

export default function DriverIncidentPage() {
  const [category, setCategory] = useState('retard');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="bg-white px-4 pb-3 pt-3">
        <Link href="/conducteur/plus" className="text-[var(--drv-red)]">
          ← Plus
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Signaler un incident</h1>
        <p className="text-sm text-[var(--drv-muted)]">
          Transmission immédiate à l’exploitation
        </p>
      </div>

      <div className="space-y-3 px-4 py-4">
        {(err || ok) && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {err || ok}
          </div>
        )}

        <section className="drv-card space-y-3 p-4">
          <label className="block text-xs font-semibold text-[var(--drv-muted)]">
            Type
            <select
              className="drv-input mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[var(--drv-muted)]">
            Gravité
            <select
              className="drv-input mt-1"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="low">Faible</option>
              <option value="medium">Moyenne</option>
              <option value="high">Élevée</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-[var(--drv-muted)]">
            Description
            <textarea
              className="drv-input mt-1 min-h-[140px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la situation, le lieu, l’heure…"
            />
          </label>
          <button
            type="button"
            className="drv-btn-black"
            disabled={busy || description.trim().length < 5}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await api('/portal/me/incidents', {
                  method: 'POST',
                  body: JSON.stringify({ category, severity, description }),
                });
                setOk('Incident transmis à l’exploitation');
                setDescription('');
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer le signalement
          </button>
        </section>
      </div>
    </div>
  );
}
