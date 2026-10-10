'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtEur } from '@/lib/hr';

type Emp = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  contractType?: string | null;
  classification?: string | null;
  baseMonthlySalary?: number | null;
  status: string;
  city?: string | null;
  hiredAt?: string | null;
  driver?: { id: string } | null;
  accountLink?: { user: { email: string; status: string } } | null;
  depot?: { id: string; name: string } | null;
};

type SortKey =
  | 'lastName'
  | 'matricule'
  | 'jobTitle'
  | 'contractType'
  | 'baseMonthlySalary'
  | 'status'
  | 'depot';

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  trial: 'Essai',
  suspended: 'Suspendu',
  left: 'Parti',
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Emp[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [contract, setContract] = useState('all');
  const [depotId, setDepotId] = useState('all');
  const [profile, setProfile] = useState<'all' | 'driver' | 'office'>('all');
  const [account, setAccount] = useState<'all' | 'linked' | 'none'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('lastName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Emp[]>('/employees')
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, []);

  const depots = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of rows) {
      if (e.depot) map.set(e.depot.id, e.depot.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [rows]);

  const contracts = useMemo(() => {
    const set = new Set<string>();
    for (const e of rows) if (e.contractType) set.add(e.contractType);
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = rows.filter((e) => {
      if (status !== 'all' && e.status !== status) return false;
      if (contract !== 'all' && e.contractType !== contract) return false;
      if (depotId !== 'all' && e.depot?.id !== depotId) return false;
      if (profile === 'driver' && !e.driver) return false;
      if (profile === 'office' && e.driver) return false;
      if (account === 'linked' && !e.accountLink) return false;
      if (account === 'none' && e.accountLink) return false;
      if (!s) return true;
      return [
        e.matricule,
        e.firstName,
        e.lastName,
        e.jobTitle,
        e.classification,
        e.email,
        e.phone,
        e.city,
        e.accountLink?.user.email,
        e.depot?.name,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(s));
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const val = (e: Emp): string | number => {
        switch (sortKey) {
          case 'matricule':
            return e.matricule || '';
          case 'jobTitle':
            return e.jobTitle || '';
          case 'contractType':
            return e.contractType || '';
          case 'baseMonthlySalary':
            return e.baseMonthlySalary ?? -1;
          case 'status':
            return e.status || '';
          case 'depot':
            return e.depot?.name || '';
          default:
            return `${e.lastName} ${e.firstName}`.toLowerCase();
        }
      };
      const av = val(a);
      const bv = val(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), 'fr') * dir;
    });
    return list;
  }, [rows, q, status, contract, depotId, profile, account, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortTh({
    k,
    children,
    className = 'text-left',
  }: {
    k: SortKey;
    children: React.ReactNode;
    className?: string;
  }) {
    const active = sortKey === k;
    return (
      <th className={`px-3 py-2 ${className}`}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 uppercase ${
            active ? 'text-[var(--fg)]' : ''
          }`}
          onClick={() => toggleSort(k)}
        >
          {children}
          {active && (
            <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
          )}
        </button>
      </th>
    );
  }

  const stats = {
    total: filtered.length,
    drivers: filtered.filter((e) => e.driver).length,
    noAccess: filtered.filter((e) => !e.accountLink).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Module RH</p>
          <h1 className="text-2xl font-bold">Salariés</h1>
          <p className="text-sm text-[var(--muted)]">
            Recherche, filtres et tri — fiches contrat, paie et accès logiciel
          </p>
        </div>
        <div className="text-xs text-[var(--muted)]">
          {stats.total} résultat{stats.total > 1 ? 's' : ''} ·{' '}
          {stats.drivers} conducteur{stats.drivers > 1 ? 's' : ''} ·{' '}
          {stats.noAccess} sans accès
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-[14rem] flex-1 text-sm"
            placeholder="Rechercher nom, matricule, poste, e-mail, ville…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input w-auto text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Tous statuts</option>
            <option value="active">Actifs</option>
            <option value="trial">Essai</option>
            <option value="suspended">Suspendus</option>
            <option value="left">Partis</option>
          </select>
          <select
            className="input w-auto text-sm"
            value={contract}
            onChange={(e) => setContract(e.target.value)}
          >
            <option value="all">Tous contrats</option>
            {contracts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input w-auto text-sm"
            value={depotId}
            onChange={(e) => setDepotId(e.target.value)}
          >
            <option value="all">Tous dépôts</option>
            {depots.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="input w-auto text-sm"
            value={profile}
            onChange={(e) =>
              setProfile(e.target.value as 'all' | 'driver' | 'office')
            }
          >
            <option value="all">Tous profils</option>
            <option value="driver">Conducteurs</option>
            <option value="office">Sédentaires</option>
          </select>
          <select
            className="input w-auto text-sm"
            value={account}
            onChange={(e) =>
              setAccount(e.target.value as 'all' | 'linked' | 'none')
            }
          >
            <option value="all">Tous accès</option>
            <option value="linked">Compte lié</option>
            <option value="none">Sans compte</option>
          </select>
          {(q ||
            status !== 'all' ||
            contract !== 'all' ||
            depotId !== 'all' ||
            profile !== 'all' ||
            account !== 'all') && (
            <button
              type="button"
              className="btn-ghost border border-[var(--border)] text-xs"
              onClick={() => {
                setQ('');
                setStatus('all');
                setContract('all');
                setDepotId('all');
                setProfile('all');
                setAccount('all');
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-[#f8fafc] text-[10px] uppercase text-[var(--muted)]">
            <tr>
              <SortTh k="matricule">Matricule</SortTh>
              <SortTh k="lastName">Nom</SortTh>
              <SortTh k="jobTitle">Poste</SortTh>
              <SortTh k="contractType">Contrat</SortTh>
              <SortTh k="depot">Dépôt</SortTh>
              <SortTh k="baseMonthlySalary" className="text-right">
                Salaire
              </SortTh>
              <SortTh k="status">Statut</SortTh>
              <th className="px-3 py-2 text-left">Profil</th>
              <th className="px-3 py-2 text-left">Compte</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-mono text-xs">{e.matricule}</td>
                <td className="px-3 py-2 font-semibold">
                  <Link className="text-action" href={`/app/employees/${e.id}`}>
                    {e.lastName} {e.firstName}
                  </Link>
                  {e.city && (
                    <div className="text-[10px] font-normal text-[var(--muted)]">
                      {e.city}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{e.jobTitle || '—'}</td>
                <td className="px-3 py-2 text-xs">{e.contractType || '—'}</td>
                <td className="px-3 py-2 text-xs">{e.depot?.name || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtEur(e.baseMonthlySalary)}
                </td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      e.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : e.status === 'left'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {STATUS_LABEL[e.status] || e.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {e.driver ? (
                    <Link
                      href={`/app/drivers/${e.driver.id}`}
                      className="text-action"
                    >
                      Conducteur
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">Sédentaire</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {e.accountLink ? (
                    <span title={e.accountLink.user.email}>
                      {e.accountLink.user.status}
                    </span>
                  ) : (
                    <span className="text-amber-700">Non lié</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/app/employees/${e.id}`}
                    className="text-xs text-action"
                  >
                    Fiche
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
                  Aucun salarié ne correspond aux filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
