'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, openPrintHtml } from '@/lib/api';
import { fmtEur, fmtHours, PAYSLIP_STATUS } from '@/lib/hr';

type Line = {
  id: string;
  code: string;
  label: string;
  kind: string;
  quantity: number;
  rate: number;
  amount: number;
};

type Payslip = {
  id: string;
  yearMonth: string;
  status: string;
  workedHours: number;
  overtimeHours: number;
  nightHours: number;
  leaveDays: number;
  baseSalary: number;
  grossAmount: number;
  employeeCharges: number;
  employerCharges: number;
  netAmount: number;
  notes?: string | null;
  sourceHoursJson: string;
  lines: Line[];
  employee: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    contractType?: string | null;
    baseMonthlySalary?: number | null;
    driver?: { id: string } | null;
    accountLink?: { user?: { email: string } } | null;
  };
};

export default function PayslipEditPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Payslip | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newLine, setNewLine] = useState({
    code: 'PRIM',
    label: 'Prime transport',
    amount: 50,
    kind: 'earning',
  });

  const load = useCallback(() => {
    return api<Payslip>(`/hr/payslips/${id}`).then(setP);
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function setStatus(status: string) {
    setBusy(true);
    setErr('');
    try {
      await api(`/hr/payslips/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMsg(`Statut → ${PAYSLIP_STATUS[status] || status}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(notes: string) {
    await api(`/hr/payslips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
    setMsg('Notes enregistrées');
    load();
  }

  async function addLine() {
    setBusy(true);
    try {
      await api(`/hr/payslips/${id}/lines`, {
        method: 'POST',
        body: JSON.stringify(newLine),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateLine(line: Line, amount: number) {
    await api(`/hr/payslips/${id}/lines/${line.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    });
    await load();
  }

  async function removeLine(lineId: string) {
    await api(`/hr/payslips/${id}/lines/${lineId}`, { method: 'DELETE' });
    await load();
  }

  if (!p && !err) {
    return <p className="text-sm text-[var(--muted)]">Chargement fiche…</p>;
  }
  if (!p) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
        {err}
      </div>
    );
  }

  let days: Array<{ date: string; hours: number; source: string }> = [];
  try {
    days = JSON.parse(p.sourceHoursJson).days || [];
  } catch {
    days = [];
  }

  const editable = p.status === 'draft';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/hr/payroll" className="text-xs text-action">
            ← Paie
          </Link>
          <h1 className="text-2xl font-bold">
            Bulletin {p.yearMonth} — {p.employee.lastName}{' '}
            {p.employee.firstName}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {p.employee.matricule} · {p.employee.jobTitle || 'Salarié'} ·{' '}
            {p.employee.contractType || '—'}
            {p.employee.driver ? ' · Conducteur' : ''}
            {p.employee.accountLink?.user?.email
              ? ` · Compte ${p.employee.accountLink.user.email}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge-blue">
            {PAYSLIP_STATUS[p.status] || p.status}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await openPrintHtml(`/documents/print/payslip/${id}`);
                setMsg(
                  'Fenêtre d’impression ouverte — choisissez « Enregistrer en PDF »',
                );
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Imprimer / PDF
          </button>
          {editable && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => setStatus('validated')}
            >
              Valider
            </button>
          )}
          {p.status === 'validated' && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => setStatus('paid')}
            >
              Marquer payée
            </button>
          )}
          {editable && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setStatus('cancelled')}
            >
              Annuler
            </button>
          )}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ['Heures', fmtHours(p.workedHours)],
          ['HS', fmtHours(p.overtimeHours)],
          ['Nuit', fmtHours(p.nightHours)],
          ['Congés (j)', p.leaveDays.toFixed(1)],
          ['Brut', fmtEur(p.grossAmount)],
          ['Net à payer', fmtEur(p.netAmount)],
        ].map(([l, v]) => (
          <div key={l} className="card p-3">
            <div className="text-[10px] uppercase text-[var(--muted)]">{l}</div>
            <div className="text-lg font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase text-[var(--muted)]">
            Salaire de base
          </div>
          <div className="font-semibold tabular-nums">{fmtEur(p.baseSalary)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[var(--muted)]">
            Charges salariales
          </div>
          <div className="font-semibold tabular-nums">
            {fmtEur(p.employeeCharges)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[var(--muted)]">
            Charges patronales
          </div>
          <div className="font-semibold tabular-nums">
            {fmtEur(p.employerCharges)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[var(--muted)]">
            Coût employeur
          </div>
          <div className="font-semibold tabular-nums">
            {fmtEur(p.grossAmount + p.employerCharges)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-bold">
            Rubriques
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">Taux</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l) => (
                <tr key={l.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                  <td className="px-3 py-2">
                    {l.label}
                    <span className="ml-1 text-[10px] text-[var(--muted)]">
                      {l.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.quantity}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.rate}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editable && l.kind !== 'info' ? (
                      <input
                        className="input w-24 text-right text-sm"
                        type="number"
                        step="0.01"
                        defaultValue={l.amount}
                        onBlur={(e) =>
                          updateLine(l, Number(e.target.value))
                        }
                      />
                    ) : (
                      <span className="font-semibold tabular-nums">
                        {fmtEur(l.amount)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editable && l.code !== 'NET' && (
                      <button
                        type="button"
                        className="text-xs text-rose-600"
                        onClick={() => removeLine(l.id)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editable && (
            <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] p-3">
              <input
                className="input w-20 text-sm"
                placeholder="Code"
                value={newLine.code}
                onChange={(e) =>
                  setNewLine((s) => ({ ...s, code: e.target.value }))
                }
              />
              <input
                className="input min-w-[12rem] flex-1 text-sm"
                placeholder="Libellé"
                value={newLine.label}
                onChange={(e) =>
                  setNewLine((s) => ({ ...s, label: e.target.value }))
                }
              />
              <input
                className="input w-28 text-sm"
                type="number"
                step="0.01"
                value={newLine.amount}
                onChange={(e) =>
                  setNewLine((s) => ({
                    ...s,
                    amount: Number(e.target.value),
                  }))
                }
              />
              <select
                className="input w-auto text-sm"
                value={newLine.kind}
                onChange={(e) =>
                  setNewLine((s) => ({ ...s, kind: e.target.value }))
                }
              >
                <option value="earning">Gain</option>
                <option value="deduction">Retenue</option>
                <option value="info">Info</option>
                <option value="employer">Patronal</option>
              </select>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={addLine}
              >
                Ajouter
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] bg-[#f8fafc] px-4 py-3 text-sm">
            <div>
              Brut <strong>{fmtEur(p.grossAmount)}</strong>
            </div>
            <div>
              Charges sal. <strong>{fmtEur(p.employeeCharges)}</strong>
            </div>
            <div>
              Net <strong>{fmtEur(p.netAmount)}</strong>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 text-xs font-bold uppercase text-[var(--muted)]">
              Détail heures planning
            </h2>
            <ul className="max-h-64 space-y-1 overflow-auto text-xs">
              {days.map((d) => (
                <li key={d.date} className="flex justify-between">
                  <span>
                    {d.date}{' '}
                    <span className="text-[var(--muted)]">({d.source})</span>
                  </span>
                  <span className="tabular-nums">{fmtHours(d.hours)}</span>
                </li>
              ))}
              {!days.length && (
                <li className="text-[var(--muted)]">Pas de détail journalier.</li>
              )}
            </ul>
          </section>
          <section className="card p-4">
            <h2 className="mb-2 text-xs font-bold uppercase text-[var(--muted)]">
              Notes RH
            </h2>
            <textarea
              className="input min-h-[100px] text-sm"
              defaultValue={p.notes || ''}
              disabled={!editable}
              onBlur={(e) => {
                if (editable && e.target.value !== (p.notes || '')) {
                  saveNotes(e.target.value);
                }
              }}
            />
          </section>
          <Link
            href={`/app/employees/${p.employee.id}`}
            className="btn-secondary inline-flex"
          >
            Fiche salarié
          </Link>
        </div>
      </div>
    </div>
  );
}
