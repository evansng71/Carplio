'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [budgets, setBudgets] = useState<Array<{ id: string; name: string; year: number; source: string }>>([]);
  const [compare, setCompare] = useState<unknown>(null);
  const [sims, setSims] = useState<Array<{ id: string; name: string; resultJson: string }>>([]);
  const [msg, setMsg] = useState('');

  const load = () => {
    api('/analytics/overview').then(setOverview);
    api('/budgets').then(setBudgets);
    api('/simulations').then(setSims);
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">BI / Budgets / Simulations</h1>
        <p className="text-sm text-[var(--muted)]">
          Indicateurs réels, budget depuis planning, comparaison, simulation isolée.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(overview)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => (
              <div key={k} className="card p-4">
                <div className="text-xs uppercase text-[var(--muted)]">{k}</div>
                <div className="text-2xl font-bold">{v}</div>
              </div>
            ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          onClick={async () => {
            await api('/budgets', {
              method: 'POST',
              body: JSON.stringify({
                name: `Budget ${new Date().getFullYear()} planning`,
                year: new Date().getFullYear(),
                fromPlanning: true,
              }),
            });
            setMsg('Budget créé depuis le planning théorique');
            load();
          }}
        >
          Budget depuis planning
        </button>
        <button
          className="btn-ghost border border-[var(--border)]"
          onClick={async () => {
            await api('/simulations', {
              method: 'POST',
              body: JSON.stringify({
                name: 'Scénario +10% km',
                kmFactor: 1.1,
                costFactor: 1.05,
              }),
            });
            setMsg('Simulation isolée créée');
            load();
          }}
        >
          Lancer simulation
        </button>
      </div>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Budgets</h2>
        {budgets.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2 text-sm">
            <span>
              {b.name} · {b.year} · {b.source}
            </span>
            <button
              className="btn-primary"
              onClick={async () => {
                setCompare(await api(`/budgets/${b.id}/compare`));
              }}
            >
              Budget vs réalisé
            </button>
          </div>
        ))}
        {compare && (
          <pre className="max-h-64 overflow-auto rounded bg-night/5 p-3 text-[10px]">
            {JSON.stringify(compare, null, 2)}
          </pre>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Simulations</h2>
        <ul className="mt-2 text-sm">
          {sims.map((s) => (
            <li key={s.id}>
              {s.name} — {s.resultJson}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
