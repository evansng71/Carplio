'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { INTERVIEW_KINDS } from '@/lib/hr';

type Interview = {
  id: string;
  title: string;
  kind: string;
  status: string;
  scheduledAt?: string | null;
  heldAt?: string | null;
  objectives?: string | null;
  notes?: string | null;
  nextActions?: string | null;
  rating?: number | null;
  employee: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
  };
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
};

export default function HrInterviewsPage() {
  const [rows, setRows] = useState<Interview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    kind: 'annuel',
    title: '',
    scheduledAt: '',
    objectives: '',
  });

  function reload() {
    return Promise.all([
      api<Interview[]>('/hr/interviews'),
      api<Employee[]>('/employees'),
    ]).then(([i, e]) => {
      setRows(i);
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
      await api('/hr/interviews', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt || undefined,
        }),
      });
      setOk('Entretien planifié');
      setForm({
        employeeId: '',
        kind: 'annuel',
        title: '',
        scheduledAt: '',
        objectives: '',
      });
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function markDone(id: string) {
    try {
      await api(`/hr/interviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'done',
          heldAt: new Date().toISOString(),
        }),
      });
      setOk('Entretien clôturé');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="page-kicker">Module RH</p>
        <h1 className="text-2xl font-bold">Entretiens</h1>
        <p className="text-sm text-[var(--muted)]">
          Annuels, professionnels, embauche, suivi — liés aux fiches salariés /
          conducteurs
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

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase text-[var(--muted)]">
          Planifier
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
                {e.lastName} {e.firstName}
              </option>
            ))}
          </select>
          <select
            className="input w-auto text-sm"
            value={form.kind}
            onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value }))}
          >
            {Object.entries(INTERVIEW_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            className="input min-w-[14rem] flex-1 text-sm"
            placeholder="Titre"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          />
          <input
            type="datetime-local"
            className="input w-auto text-sm"
            value={form.scheduledAt}
            onChange={(e) =>
              setForm((s) => ({ ...s, scheduledAt: e.target.value }))
            }
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!form.employeeId || !form.title}
            onClick={create}
          >
            Créer
          </button>
        </div>
        <input
          className="input mt-2 w-full text-sm"
          placeholder="Objectifs"
          value={form.objectives}
          onChange={(e) =>
            setForm((s) => ({ ...s, objectives: e.target.value }))
          }
        />
      </section>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Salarié</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Titre</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-xs tabular-nums">
                  {r.scheduledAt
                    ? new Date(r.scheduledAt).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-2 font-medium">
                  {r.employee.lastName} {r.employee.firstName}
                </td>
                <td className="px-3 py-2 text-xs">
                  {INTERVIEW_KINDS[r.kind] || r.kind}
                </td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2 text-xs">{r.status}</td>
                <td className="px-3 py-2 text-right">
                  {r.status === 'planned' && (
                    <button
                      type="button"
                      className="text-xs text-action"
                      onClick={() => markDone(r.id)}
                    >
                      Clôturer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
