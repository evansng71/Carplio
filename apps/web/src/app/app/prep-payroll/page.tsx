'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PrepPayrollPage() {
  const [rules, setRules] = useState<Array<{ id: string; code: string; label: string; formula: string; period: string }>>([]);
  const [daily, setDaily] = useState<Array<{ id: string; workDate: string; label: string; quantity: number; amount: number; checked: boolean; employeeId: string }>>([]);
  const [weekly, setWeekly] = useState<unknown[]>([]);
  const [monthly, setMonthly] = useState<Array<{ id: string; yearMonth: string; label: string; quantity: number; amount: number; exported: boolean }>>([]);
  const [counters, setCounters] = useState<unknown[]>([]);
  const [exports, setExports] = useState<unknown[]>([]);
  const [msg, setMsg] = useState('');
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = () => {
    api('/prep-payroll/rules').then(setRules);
    api('/prep-payroll/daily').then(setDaily);
    api('/prep-payroll/weekly').then(setWeekly);
    api(`/prep-payroll/monthly?yearMonth=${ym}`).then(setMonthly);
    api('/prep-payroll/counters').then(setCounters);
    api('/prep-payroll/exports').then(setExports);
  };
  useEffect(() => {
    load();
  }, [ym]);

  async function ensureRules() {
    if (rules.length) return;
    await api('/prep-payroll/rules', {
      method: 'POST',
      body: JSON.stringify({
        code: 'PRESENCE',
        label: 'Heures de présence',
        period: 'daily',
        formula: 'presence_hours * rate',
        priority: 10,
      }),
    });
    await api('/prep-payroll/rules', {
      method: 'POST',
      body: JSON.stringify({
        code: 'HS',
        label: 'Heures supp.',
        period: 'daily',
        formula: 'overtime_hours * rate',
        priority: 20,
      }),
    });
    setMsg('Règles DEMO créées');
    load();
  }

  async function compute() {
    await ensureRules();
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    const r = await api<{ dailyLines: number; weeklyLines: number; monthlyLines: number }>(
      '/prep-payroll/compute',
      { method: 'POST', body: JSON.stringify({ from: from.toISOString(), to: to.toISOString() }) },
    );
    setMsg(`Calcul OK — ${r.dailyLines} j / ${r.weeklyLines} sem / ${r.monthlyLines} mens.`);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prépaye</h1>
        <p className="text-sm text-[var(--muted)]">
          Rubriques jour → semaine → mois, compteurs, export paie (anti-doublon).
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={compute}>
          Calculer le mois
        </button>
        <button className="btn-ghost border border-[var(--border)]" onClick={ensureRules}>
          Créer règles DEMO
        </button>
        <input className="input w-auto" value={ym} onChange={(e) => setYm(e.target.value)} />
        <button
          className="btn-primary"
          onClick={async () => {
            try {
              await api('/prep-payroll/export', {
                method: 'POST',
                body: JSON.stringify({ yearMonth: ym }),
              });
              setMsg('Export paie généré');
              load();
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Erreur export');
            }
          }}
        >
          Exporter vers paie
        </button>
      </div>

      <section className="card p-4">
        <h2 className="font-semibold">Règles</h2>
        <ul className="mt-2 text-sm">
          {rules.map((r) => (
            <li key={r.id}>
              <strong>{r.code}</strong> — {r.label} ({r.period}) · {r.formula}
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-auto p-2">
        <h2 className="px-2 font-semibold">Lignes journalières</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-2 py-1 text-left">Date</th>
              <th className="px-2 py-1 text-left">Rubrique</th>
              <th className="px-2 py-1 text-right">Qté</th>
              <th className="px-2 py-1 text-right">Montant</th>
              <th className="px-2 py-1">Ctrl</th>
            </tr>
          </thead>
          <tbody>
            {daily.slice(0, 40).map((d) => (
              <tr key={d.id} className="border-t border-[var(--border)]">
                <td className="px-2 py-1">{new Date(d.workDate).toLocaleDateString('fr-FR')}</td>
                <td className="px-2 py-1">{d.label}</td>
                <td className="px-2 py-1 text-right">{d.quantity}</td>
                <td className="px-2 py-1 text-right">{d.amount.toFixed(2)}</td>
                <td className="px-2 py-1">
                  {d.checked ? (
                    '✓'
                  ) : (
                    <button
                      className="text-action"
                      onClick={async () => {
                        await api(`/prep-payroll/daily/${d.id}/check`, {
                          method: 'POST',
                          body: '{}',
                        });
                        load();
                      }}
                    >
                      Valider
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="font-semibold">Hebdo</h2>
          <pre className="mt-2 max-h-48 overflow-auto text-[10px]">{JSON.stringify(weekly.slice(0, 10), null, 2)}</pre>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Mensuel {ym}</h2>
          <ul className="mt-2 text-sm">
            {monthly.map((m) => (
              <li key={m.id}>
                {m.label}: {m.quantity} / {m.amount.toFixed(2)} € {m.exported ? '(exporté)' : ''}
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Compteurs & exports</h2>
          <pre className="mt-2 max-h-32 overflow-auto text-[10px]">{JSON.stringify(counters, null, 2)}</pre>
          <pre className="mt-2 max-h-32 overflow-auto text-[10px]">{JSON.stringify(exports, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
