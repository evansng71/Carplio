'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function QualityPage() {
  const [classes, setClasses] = useState<Array<{ id: string; level: string; code: string; label: string }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; source: string; category: string; nature?: string; precision?: string; severity: string; description: string }>>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    category: 'retard',
    nature: 'circulation',
    precision: 'embouteillage',
    overPrecision: 'A43',
    severity: 'medium',
    description: '',
    openRepair: false,
  });
  const [msg, setMsg] = useState('');

  const load = () => {
    api('/quality/classifications').then(setClasses);
    api('/quality/events').then(setEvents);
    api('/quality/stats').then(setStats);
  };
  useEffect(() => {
    load();
  }, []);

  async function seedTaxonomy() {
    const items = [
      { level: 'source', code: 'driver', label: 'Conducteur' },
      { level: 'source', code: 'ops', label: 'Exploitation' },
      { level: 'cause', code: 'traffic', label: 'Circulation' },
      { level: 'nature', code: 'retard', label: 'Retard' },
      { level: 'precision', code: 'embouteillage', label: 'Embouteillage' },
      { level: 'over_precision', code: 'A43', label: 'A43' },
    ];
    for (const i of items) {
      try {
        await api('/quality/classifications', { method: 'POST', body: JSON.stringify(i) });
      } catch {
        /* ignore dup */
      }
    }
    setMsg('Taxonomie seedée');
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Qualité / Main courante</h1>
        <p className="text-sm text-[var(--muted)]">
          Source → cause → nature → précision → sur-précision.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      <div className="flex gap-2">
        <button className="btn-ghost border border-[var(--border)]" onClick={seedTaxonomy}>
          Initialiser taxonomie
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Nouvel événement</h2>
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="retard">Retard</option>
            <option value="panne">Panne</option>
            <option value="reclamation">Réclamation</option>
            <option value="accident">Accident</option>
          </select>
          <input className="input" placeholder="Nature" value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} />
          <input className="input" placeholder="Précision" value={form.precision} onChange={(e) => setForm({ ...form, precision: e.target.value })} />
          <input className="input" placeholder="Sur-précision" value={form.overPrecision} onChange={(e) => setForm({ ...form, overPrecision: e.target.value })} />
          <textarea className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.openRepair} onChange={(e) => setForm({ ...form, openRepair: e.target.checked })} />
            Ouvrir signalement atelier si panne
          </label>
          <button
            className="btn-primary"
            onClick={async () => {
              await api('/quality/events', {
                method: 'POST',
                body: JSON.stringify({
                  ...form,
                  openRepair: form.openRepair || form.category === 'panne',
                }),
              });
              setMsg('Événement enregistré');
              setForm({ ...form, description: '' });
              load();
            }}
          >
            Enregistrer
          </button>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold">Statistiques</h2>
          <pre className="mt-2 max-h-64 overflow-auto text-[10px]">{JSON.stringify(stats, null, 2)}</pre>
          <h3 className="mt-4 font-semibold">Référentiel</h3>
          <ul className="mt-1 max-h-40 overflow-auto text-xs">
            {classes.map((c) => (
              <li key={c.id}>
                [{c.level}] {c.code} — {c.label}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card divide-y divide-[var(--border)]">
        {events.map((e) => (
          <div key={e.id} className="px-4 py-3 text-sm">
            <div className="font-semibold">
              {e.category} / {e.nature} / {e.precision} · {e.severity}
            </div>
            <div className="text-[var(--muted)]">
              source {e.source} — {e.description}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
