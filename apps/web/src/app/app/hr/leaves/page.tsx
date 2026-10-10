'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { LEAVE_STATUS, LEAVE_TYPES } from '@/lib/hr';

type Leave = {
  id: string;
  type: string;
  status: string;
  startsOn: string;
  endsOn: string;
  comment?: string | null;
  decisionNote?: string | null;
  employee: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    driver?: { id: string } | null;
    depot?: { name: string } | null;
  };
};

type Balance = {
  id: string;
  year: number;
  type: string;
  entitled: number;
  used: number;
  remaining: number;
  employee: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
    driver?: { id: string } | null;
  };
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
};

type Tab = 'inbox' | 'calendar' | 'balances' | 'create';

function leaveDays(startsOn: string, endsOn: string) {
  const a = new Date(startsOn);
  const b = new Date(endsOn);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)) + 1;
}

function statusTone(status: string) {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-rose-100 text-rose-800';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-900';
}

export default function HrLeavesPage() {
  const yearNow = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>('inbox');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState('submitted');
  const [filterType, setFilterType] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [balanceYear, setBalanceYear] = useState(yearNow);
  const [balanceQ, setBalanceQ] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    type: 'conges',
    startsOn: '',
    endsOn: '',
    comment: '',
    autoApprove: true,
  });

  const loadLeaves = useCallback(() => {
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterType !== 'all') params.set('type', filterType);
    if (filterEmployee !== 'all') params.set('employeeId', filterEmployee);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    const qs = params.toString();
    return api<Leave[]>(`/hr/leaves${qs ? `?${qs}` : ''}`);
  }, [filterStatus, filterType, filterEmployee, filterFrom, filterTo]);

  const reload = useCallback(() => {
    return Promise.all([
      loadLeaves(),
      api<Balance[]>(`/hr/leave-balances?year=${balanceYear}`),
      api<Employee[]>('/employees'),
    ]).then(([l, b, e]) => {
      setLeaves(l);
      setBalances(b);
      setEmployees(e);
    });
  }, [loadLeaves, balanceYear]);

  useEffect(() => {
    reload().catch((e) => setErr(e.message));
  }, [reload]);

  const pendingCount = useMemo(
    () => leaves.filter((l) => l.status === 'submitted').length,
    [leaves],
  );

  const calendarGroups = useMemo(() => {
    const map = new Map<string, Leave[]>();
    for (const l of leaves.filter((x) => x.status !== 'rejected')) {
      const key = l.startsOn.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [leaves]);

  const balancesFiltered = useMemo(() => {
    const s = balanceQ.trim().toLowerCase();
    if (!s) return balances;
    return balances.filter((b) =>
      [
        b.employee.lastName,
        b.employee.firstName,
        b.employee.matricule,
        b.type,
      ]
        .join(' ')
        .toLowerCase()
        .includes(s),
    );
  }, [balances, balanceQ]);

  const balancesByEmployee = useMemo(() => {
    const map = new Map<
      string,
      { employee: Balance['employee']; rows: Balance[] }
    >();
    for (const b of balancesFiltered) {
      const key = b.employee.id;
      if (!map.has(key)) {
        map.set(key, { employee: b.employee, rows: [] });
      }
      map.get(key)!.rows.push(b);
    }
    return [...map.values()].sort((a, b) =>
      a.employee.lastName.localeCompare(b.employee.lastName, 'fr'),
    );
  }, [balancesFiltered]);

  async function decide(
    id: string,
    status: 'approved' | 'rejected',
    decisionNote?: string,
  ) {
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await api(`/hr/leaves/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ status, decisionNote }),
      });
      setOk(
        status === 'approved'
          ? 'Absence approuvée — solde mis à jour et planning synchronisé si conducteur'
          : 'Demande refusée',
      );
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createLeave() {
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await api('/hr/leaves', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: form.employeeId,
          type: form.type,
          startsOn: form.startsOn,
          endsOn: form.endsOn,
          comment: form.comment,
          autoApprove: form.autoApprove,
        }),
      });
      setOk(
        form.autoApprove
          ? 'Absence enregistrée, soldes et planning mis à jour'
          : 'Demande créée — en attente de validation',
      );
      setForm((s) => ({
        ...s,
        startsOn: '',
        endsOn: '',
        comment: '',
      }));
      setTab('inbox');
      setFilterStatus(form.autoApprove ? 'approved' : 'submitted');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function ensureBalances() {
    setBusy(true);
    try {
      const r = await api<{ created: number; year: number }>(
        '/hr/leave-balances/ensure',
        {
          method: 'POST',
          body: JSON.stringify({ year: balanceYear }),
        },
      );
      setOk(`Soldes ${r.year} : ${r.created} ligne(s) créée(s)`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Module RH</p>
          <h1 className="text-2xl font-bold">Congés & absences</h1>
          <p className="text-sm text-[var(--muted)]">
            Validation, soldes et synchronisation planning pour les conducteurs
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setTab('create')}
        >
          Nouvelle absence
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            {
              label: 'À valider',
              value: String(
                filterStatus === 'submitted'
                  ? pendingCount
                  : leaves.filter((l) => l.status === 'submitted').length,
              ),
              onClick: () => {
                setFilterStatus('submitted');
                setTab('inbox');
              },
            },
            {
              label: 'Affichées',
              value: String(leaves.length),
              onClick: () => setTab('inbox'),
            },
            {
              label: 'Soldes année',
              value: String(balanceYear),
              onClick: () => setTab('balances'),
            },
          ] as const
        ).map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className="card p-3 text-left transition hover:border-action/40"
          >
            <div className="text-[10px] uppercase text-[var(--muted)]">
              {card.label}
            </div>
            <div className="text-xl font-bold">{card.value}</div>
          </button>
        ))}
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

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {(
          [
            ['inbox', 'Demandes'],
            ['calendar', 'Calendrier'],
            ['balances', 'Soldes'],
            ['create', 'Saisie RH'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={
              tab === k
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }
            onClick={() => setTab(k)}
          >
            {label}
            {k === 'inbox' && filterStatus === 'submitted' && pendingCount > 0
              ? ` (${pendingCount})`
              : ''}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <section className="card max-w-3xl space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">Poser une absence</h2>
            <p className="text-sm text-[var(--muted)]">
              Saisie RH directe — cochez « Approuver » pour débiter le solde et
              bloquer le planning conducteur immédiatement.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs sm:col-span-2">
              Salarié
              <select
                className="input mt-1"
                value={form.employeeId}
                onChange={(e) =>
                  setForm((s) => ({ ...s, employeeId: e.target.value }))
                }
              >
                <option value="">Choisir…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.lastName} {e.firstName} ({e.matricule})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Type
              <select
                className="input mt-1"
                value={form.type}
                onChange={(e) =>
                  setForm((s) => ({ ...s, type: e.target.value }))
                }
              >
                {Object.entries(LEAVE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs">
              <input
                type="checkbox"
                checked={form.autoApprove}
                onChange={(e) =>
                  setForm((s) => ({ ...s, autoApprove: e.target.checked }))
                }
              />
              Approuver & synchroniser le planning
            </label>
            <label className="block text-xs">
              Du
              <input
                type="date"
                className="input mt-1"
                value={form.startsOn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, startsOn: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs">
              Au
              <input
                type="date"
                className="input mt-1"
                value={form.endsOn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, endsOn: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              Commentaire
              <input
                className="input mt-1"
                value={form.comment}
                onChange={(e) =>
                  setForm((s) => ({ ...s, comment: e.target.value }))
                }
                placeholder="Motif, précisions…"
              />
            </label>
          </div>
          {form.startsOn && form.endsOn && (
            <p className="text-xs text-[var(--muted)]">
              Durée estimée :{' '}
              <strong>{leaveDays(form.startsOn, form.endsOn)} jour(s)</strong>
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={
              busy || !form.employeeId || !form.startsOn || !form.endsOn
            }
            onClick={createLeave}
          >
            Enregistrer l’absence
          </button>
        </section>
      )}

      {tab === 'inbox' && (
        <>
          <div className="card flex flex-wrap gap-2 p-3">
            <select
              className="input w-auto text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="submitted">En attente</option>
              <option value="approved">Approuvées</option>
              <option value="rejected">Refusées</option>
              <option value="all">Tous statuts</option>
            </select>
            <select
              className="input w-auto text-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tous types</option>
              {Object.entries(LEAVE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="input min-w-[12rem] text-sm"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
            >
              <option value="all">Tous salariés</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.lastName} {e.firstName}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input w-auto text-sm"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              title="À partir du"
            />
            <input
              type="date"
              className="input w-auto text-sm"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              title="Jusqu’au"
            />
          </div>

          <div className="space-y-3">
            {leaves.map((l) => {
              const days = leaveDays(l.startsOn, l.endsOn);
              return (
                <article
                  key={l.id}
                  className="card flex flex-wrap items-start justify-between gap-4 p-4"
                >
                  <div className="min-w-[16rem] flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/employees/${l.employee.id}`}
                        className="font-semibold text-action"
                      >
                        {l.employee.lastName} {l.employee.firstName}
                      </Link>
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {l.employee.matricule}
                      </span>
                      {l.employee.driver && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                          Conducteur
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(l.status)}`}
                      >
                        {LEAVE_STATUS[l.status] || l.status}
                      </span>
                    </div>
                    <div className="text-sm">
                      <strong>{LEAVE_TYPES[l.type] || l.type}</strong>
                      {' · '}
                      {new Date(l.startsOn).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(l.endsOn).toLocaleDateString('fr-FR')}
                      <span className="text-[var(--muted)]">
                        {' '}
                        ({days} j)
                      </span>
                    </div>
                    {l.employee.depot && (
                      <div className="text-xs text-[var(--muted)]">
                        Dépôt {l.employee.depot.name}
                      </div>
                    )}
                    {l.comment && (
                      <p className="text-xs text-[var(--muted)]">
                        « {l.comment} »
                      </p>
                    )}
                    {l.decisionNote && (
                      <p className="text-xs text-[var(--muted)]">
                        Décision : {l.decisionNote}
                      </p>
                    )}
                  </div>
                  {l.status === 'submitted' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => decide(l.id, 'approved')}
                      >
                        Approuver
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => {
                          const note = window.prompt('Motif du refus (optionnel)') || undefined;
                          decide(l.id, 'rejected', note);
                        }}
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                  {l.status === 'approved' && l.employee.driver && (
                    <Link
                      href={`/app/drivers/${l.employee.driver.id}`}
                      className="text-xs text-action"
                    >
                      Voir indispo ops →
                    </Link>
                  )}
                </article>
              );
            })}
            {!leaves.length && (
              <div className="card px-4 py-10 text-center text-sm text-[var(--muted)]">
                Aucune demande pour ces filtres.
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'calendar' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Vue par mois des absences affichées (hors refusées). Ajustez les
            filtres dans l’onglet Demandes.
          </p>
          {calendarGroups.map(([ym, items]) => (
            <section key={ym} className="card overflow-hidden p-0">
              <div className="border-b border-[var(--border)] bg-[#f8fafc] px-4 py-2 text-sm font-bold capitalize">
                {new Date(`${ym}-01`).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {items.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <span>
                      <strong>
                        {l.employee.lastName} {l.employee.firstName}
                      </strong>{' '}
                      — {LEAVE_TYPES[l.type] || l.type}
                    </span>
                    <span className="tabular-nums text-xs text-[var(--muted)]">
                      {new Date(l.startsOn).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(l.endsOn).toLocaleDateString('fr-FR')}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(l.status)}`}
                    >
                      {LEAVE_STATUS[l.status] || l.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!calendarGroups.length && (
            <div className="card px-4 py-10 text-center text-sm text-[var(--muted)]">
              Aucune absence à afficher.
            </div>
          )}
        </div>
      )}

      {tab === 'balances' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto text-sm"
              value={balanceYear}
              onChange={(e) => setBalanceYear(Number(e.target.value))}
            >
              {[yearNow - 1, yearNow, yearNow + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <input
              className="input min-w-[12rem] text-sm"
              placeholder="Filtrer un salarié…"
              value={balanceQ}
              onChange={(e) => setBalanceQ(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={ensureBalances}
            >
              Initialiser soldes {balanceYear}
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {balancesByEmployee.map(({ employee, rows }) => (
              <section key={employee.id} className="card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/app/employees/${employee.id}`}
                      className="font-semibold text-action"
                    >
                      {employee.lastName} {employee.firstName}
                    </Link>
                    <div className="text-[10px] text-[var(--muted)]">
                      {employee.matricule}
                      {employee.driver ? ' · Conducteur' : ''}
                    </div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase text-[var(--muted)]">
                    <tr>
                      <th className="py-1 text-left">Type</th>
                      <th className="py-1 text-right">Droit</th>
                      <th className="py-1 text-right">Pris</th>
                      <th className="py-1 text-right">Reste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.id} className="border-t border-[var(--border)]">
                        <td className="py-1.5">
                          {LEAVE_TYPES[b.type] || b.type}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {b.entitled}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {b.used}
                        </td>
                        <td
                          className={`py-1.5 text-right font-semibold tabular-nums ${
                            b.remaining <= 2 ? 'text-amber-700' : ''
                          }`}
                        >
                          {b.remaining}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
            {!balancesByEmployee.length && (
              <div className="card col-span-full px-4 py-10 text-center text-sm text-[var(--muted)]">
                Aucun solde — cliquez « Initialiser soldes ».
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
