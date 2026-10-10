'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, openPrintHtml } from '@/lib/api';
import {
  currentYearMonth,
  fmtEur,
  fmtHours,
  PAYSLIP_STATUS,
} from '@/lib/hr';

type PayslipRow = {
  id: string;
  yearMonth: string;
  status: string;
  workedHours: number;
  overtimeHours: number;
  grossAmount: number;
  netAmount: number;
  employee: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    driver?: { id: string } | null;
  };
};

type HoursRow = {
  employeeId: string;
  name: string;
  matricule: string;
  workedHours: number;
  assignmentCount: number;
};

type Template = { id: string; name: string; kind: string; isDefault?: boolean };

export default function HrPayrollPage() {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [hours, setHours] = useState<HoursRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    return Promise.all([
      api<PayslipRow[]>(`/hr/payslips?yearMonth=${yearMonth}`),
      api<{ rows: HoursRow[] }>(`/hr/hours?yearMonth=${yearMonth}`),
      api<Template[]>('/document-templates?kind=payslip').catch(() => []),
    ]).then(([p, h, t]) => {
      setRows(p);
      setHours(h.rows);
      setTemplates(t);
      setTemplateId((cur) => {
        if (cur) return cur;
        const def = t.find((x) => x.isDefault) || t[0];
        return def?.id || '';
      });
      setSelected(new Set());
    });
  }, [yearMonth]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!s) return true;
      return [
        r.employee.matricule,
        r.employee.firstName,
        r.employee.lastName,
        r.employee.jobTitle,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s));
    });
  }, [rows, q, statusFilter]);

  async function generate(overwrite = false) {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await api<{ count: number }>('/hr/payslips/generate', {
        method: 'POST',
        body: JSON.stringify({
          yearMonth,
          overwriteDraft: overwrite,
        }),
      });
      setMsg(`${r.count} fiche(s) traitée(s) pour ${yearMonth}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function printOne(id: string) {
    const qs = templateId ? `?templateId=${templateId}` : '';
    await openPrintHtml(`/documents/print/payslip/${id}${qs}`);
  }

  async function printSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    setErr('');
    try {
      for (const id of ids) {
        await printOne(id);
        await new Promise((r) => setTimeout(r, 400));
      }
      setMsg(`${ids.length} bulletin(s) ouvert(s) — utilisez « Enregistrer en PDF » dans la boîte d’impression`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function validateSelected() {
    const ids = [...selected].filter(
      (id) => rows.find((r) => r.id === id)?.status === 'draft',
    );
    if (!ids.length) {
      setErr('Sélectionnez des brouillons à valider');
      return;
    }
    setBusy(true);
    try {
      for (const id of ids) {
        await api(`/hr/payslips/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'validated' }),
        });
      }
      setMsg(`${ids.length} bulletin(s) validé(s)`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  }

  const totals = filtered.reduce(
    (a, r) => ({
      gross: a.gross + r.grossAmount,
      net: a.net + r.netAmount,
      hours: a.hours + r.workedHours,
    }),
    { gross: 0, net: 0, hours: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Module RH · Paie</p>
          <h1 className="text-2xl font-bold">Fiches de paie</h1>
          <p className="text-sm text-[var(--muted)]">
            Génération, validation et PDF (modèle personnalisable en
            Administration)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            className="input w-auto"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => generate(false)}
          >
            Générer le mois
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => generate(true)}
          >
            Régénérer brouillons
          </button>
          <Link
            href="/app/admin/templates"
            className="btn-ghost border border-[var(--border)]"
          >
            Modèles PDF
          </Link>
          <Link
            href="/app/hr/bonuses"
            className="btn-ghost border border-[var(--border)]"
          >
            Primes
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase text-[var(--muted)]">
            Heures (filtrées)
          </div>
          <div className="text-xl font-bold tabular-nums">
            {fmtHours(totals.hours)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-[var(--muted)]">Brut</div>
          <div className="text-xl font-bold tabular-nums">
            {fmtEur(totals.gross)}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-[var(--muted)]">Net</div>
          <div className="text-xl font-bold tabular-nums">
            {fmtEur(totals.net)}
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input
          className="input min-w-[12rem] flex-1 text-sm"
          placeholder="Rechercher un salarié…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input w-auto text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous statuts</option>
          {Object.entries(PAYSLIP_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="input min-w-[10rem] text-sm"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          title="Modèle d’impression"
        >
          <option value="">Modèle par défaut</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !selected.size}
          onClick={printSelected}
        >
          PDF sélection ({selected.size})
        </button>
        <button
          type="button"
          className="btn-ghost border border-[var(--border)]"
          disabled={busy || !selected.size}
          onClick={validateSelected}
        >
          Valider sélection
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={
                    filtered.length > 0 && selected.size === filtered.length
                  }
                  onChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2">Matricule</th>
              <th className="px-3 py-2">Salarié</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2 text-right">Heures</th>
              <th className="px-3 py-2 text-right">HS</th>
              <th className="px-3 py-2 text-right">Brut</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.employee.matricule}
                </td>
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/app/employees/${r.employee.id}`}
                    className="text-action"
                  >
                    {r.employee.lastName} {r.employee.firstName}
                  </Link>
                  {r.employee.driver && (
                    <span className="ml-1 text-[10px] text-action">COND.</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--muted)]">
                  {r.employee.jobTitle || '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtHours(r.workedHours)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtHours(r.overtimeHours)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtEur(r.grossAmount)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {fmtEur(r.netAmount)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {PAYSLIP_STATUS[r.status] || r.status}
                </td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-xs text-action"
                    onClick={() =>
                      printOne(r.id).catch((e) => setErr(e.message))
                    }
                  >
                    PDF
                  </button>
                  <Link
                    href={`/app/hr/payroll/${r.id}`}
                    className="text-xs font-medium text-action"
                  >
                    Éditer
                  </Link>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-10 text-center text-[var(--muted)]"
                >
                  Aucune fiche — générez le mois ou élargissez les filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold uppercase text-[var(--muted)]">
          Heures planning (source)
        </h2>
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <th className="py-1">Conducteur</th>
              <th className="py-1 text-right">Vacations</th>
              <th className="py-1 text-right">Heures</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h.employeeId} className="border-t border-[var(--border)]">
                <td className="py-1.5">
                  {h.name}{' '}
                  <span className="text-[var(--muted)]">({h.matricule})</span>
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {h.assignmentCount}
                </td>
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {fmtHours(h.workedHours)}
                </td>
              </tr>
            ))}
            {!hours.length && (
              <tr>
                <td colSpan={3} className="py-4 text-[var(--muted)]">
                  Aucune heure planning sur la période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
