'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { currentYearMonth, fmtEur } from '@/lib/hr';

type Bonus = {
  id: string;
  code: string;
  label: string;
  amount: number;
  kind: string;
  yearMonth?: string | null;
  active: boolean;
  employee: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
  };
};

type Employee = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
};

export default function HrBonusesPage() {
  const [rows, setRows] = useState<Bonus[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    code: 'PRIM',
    label: 'Prime',
    amount: 100,
    kind: 'one_shot',
    yearMonth: currentYearMonth(),
  });

  function reload() {
    return Promise.all([
      api<Bonus[]>('/hr/bonuses'),
      api<Employee[]>('/employees'),
    ]).then(([b, e]) => {
      setRows(b);
      setEmployees(e);
    });
  }

  useEffect(() => {
    reload().catch((e) => setErr(e.message));
  }, []);

  async function create() {
    setErr('');
    setOk('');
    try {
      await api('/hr/bonuses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          yearMonth: form.kind === 'one_shot' ? form.yearMonth : undefined,
        }),
      });
      setOk('Prime enregistrée — incluse à la génération du bulletin');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function toggle(id: string, active: boolean) {
    await api(`/hr/bonuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !active }),
    });
    await reload();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="page-kicker">Module RH · Paie</p>
        <h1 className="text-2xl font-bold">Primes & indemnités</h1>
        <p className="text-sm text-[var(--muted)]">
          Primes ponctuelles (mois) ou récurrentes — injectées automatiquement
          dans les bulletins à la génération
        </p>
      </div>

      {(ok || err) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || ok}
        </div>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
          Nouvelle prime
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input min-w-[12rem] text-sm"
            value={form.employeeId}
            onChange={(e) =>
              setForm((s) => ({ ...s, employeeId: e.target.value }))
            }
          >
            <option value="">Salarié…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName} {e.firstName} ({e.matricule})
              </option>
            ))}
          </select>
          <input
            className="input w-24 text-sm"
            value={form.code}
            onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
            placeholder="Code"
          />
          <input
            className="input min-w-[10rem] flex-1 text-sm"
            value={form.label}
            onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
            placeholder="Libellé"
          />
          <input
            className="input w-28 text-sm"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) =>
              setForm((s) => ({ ...s, amount: Number(e.target.value) }))
            }
          />
          <select
            className="input w-auto text-sm"
            value={form.kind}
            onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value }))}
          >
            <option value="one_shot">Ponctuelle</option>
            <option value="recurring">Récurrente</option>
          </select>
          {form.kind === 'one_shot' && (
            <input
              type="month"
              className="input w-auto text-sm"
              value={form.yearMonth}
              onChange={(e) =>
                setForm((s) => ({ ...s, yearMonth: e.target.value }))
              }
            />
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={!form.employeeId}
            onClick={create}
          >
            Ajouter
          </button>
        </div>
      </section>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Salarié</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Libellé</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Mois</th>
              <th className="px-3 py-2 text-right">Montant</th>
              <th className="px-3 py-2">Actif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-medium">
                  {r.employee.lastName} {r.employee.firstName}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.label}</td>
                <td className="px-3 py-2 text-xs">
                  {r.kind === 'recurring' ? 'Récurrente' : 'Ponctuelle'}
                </td>
                <td className="px-3 py-2 text-xs">{r.yearMonth || 'chaque mois'}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtEur(r.amount)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-xs text-action"
                    onClick={() => toggle(r.id, r.active)}
                  >
                    {r.active ? 'Oui' : 'Non'}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)]">
                  Aucune prime.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
