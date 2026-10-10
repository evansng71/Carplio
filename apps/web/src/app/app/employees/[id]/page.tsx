'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, openPrintHtml } from '@/lib/api';
import { AccessTab } from '@/components/AccessTab';
import {
  currentYearMonth,
  fmtEur,
  fmtHours,
  INTERVIEW_KINDS,
  LEAVE_STATUS,
  LEAVE_TYPES,
  PAYSLIP_STATUS,
} from '@/lib/hr';

type Tab =
  | 'identity'
  | 'contract'
  | 'pay'
  | 'payslips'
  | 'leaves'
  | 'career'
  | 'access';

type Bonus = {
  id: string;
  code: string;
  label: string;
  amount: number;
  kind: string;
  yearMonth?: string | null;
  active: boolean;
};

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
  echelon?: string | null;
  contractHours?: number | null;
  weeklyHours?: number | null;
  baseHourlyRate?: number | null;
  baseMonthlySalary?: number | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  nationality?: string | null;
  familyStatus?: string | null;
  dependentsCount?: number | null;
  collectiveAgreement?: string | null;
  jobCoefficient?: string | null;
  workTimeType?: string | null;
  mutuelle?: string | null;
  prevoyance?: string | null;
  hiredAt?: string | null;
  endedAt?: string | null;
  trialEndAt?: string | null;
  iban?: string | null;
  bic?: string | null;
  socialSecurityNumber?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  status: string;
  sensitiveNotes?: string | null;
  rhNotes?: string | null;
  _sensitiveHidden?: boolean;
  driver?: { id: string } | null;
  accountLink?: {
    user: {
      id: string;
      email: string;
      status: string;
      mustChangePassword?: boolean;
    };
  } | null;
  depot?: { id: string; name: string } | null;
  leaveRequests?: Array<{
    id: string;
    type: string;
    status: string;
    startsOn: string;
    endsOn: string;
  }>;
  leaveBalances?: Array<{
    id: string;
    year: number;
    type: string;
    entitled: number;
    used: number;
    remaining: number;
  }>;
  bonuses?: Bonus[];
  payslips?: Array<{
    id: string;
    yearMonth: string;
    status: string;
    workedHours: number;
    overtimeHours?: number;
    grossAmount: number;
    netAmount: number;
    employeeCharges?: number;
    employerCharges?: number;
  }>;
  interviews?: Array<{
    id: string;
    kind: string;
    title: string;
    status: string;
    scheduledAt?: string | null;
    objectives?: string | null;
  }>;
  enrollments?: Array<{
    id: string;
    status: string;
    session: {
      startsAt: string;
      location?: string | null;
      course: { code: string; title: string; category: string };
    };
  }>;
};

function ymd(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

const TABS: Array<[Tab, string]> = [
  ['identity', 'Identité'],
  ['contract', 'Contrat'],
  ['pay', 'Rémunération'],
  ['payslips', 'Bulletins'],
  ['leaves', 'Congés'],
  ['career', 'Parcours'],
  ['access', 'Accès'],
];

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('identity');
  const [e, setE] = useState<Emp | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [bonusForm, setBonusForm] = useState({
    code: 'PRIM',
    label: 'Prime',
    amount: 50,
    kind: 'one_shot',
    yearMonth: currentYearMonth(),
  });

  const load = useCallback(() => {
    return api<Emp>(`/employees/${id}`).then((emp) => {
      setE(emp);
      setForm({
        firstName: emp.firstName || '',
        lastName: emp.lastName || '',
        email: emp.email || '',
        phone: emp.phone || '',
        jobTitle: emp.jobTitle || '',
        contractType: emp.contractType || 'CDI',
        classification: emp.classification || '',
        echelon: emp.echelon || '',
        contractHours: emp.contractHours ?? 151.67,
        weeklyHours: emp.weeklyHours ?? 35,
        baseHourlyRate: emp.baseHourlyRate ?? 14.5,
        baseMonthlySalary: emp.baseMonthlySalary ?? 2200,
        birthDate: ymd(emp.birthDate),
        birthPlace: emp.birthPlace || '',
        addressLine1: emp.addressLine1 || '',
        addressLine2: emp.addressLine2 || '',
        postalCode: emp.postalCode || '',
        city: emp.city || '',
        country: emp.country || 'France',
        nationality: emp.nationality || '',
        familyStatus: emp.familyStatus || '',
        dependentsCount: emp.dependentsCount ?? 0,
        collectiveAgreement:
          emp.collectiveAgreement || 'Transports routiers de voyageurs',
        jobCoefficient: emp.jobCoefficient || '',
        workTimeType: emp.workTimeType || 'Temps plein',
        mutuelle: emp.mutuelle || '',
        prevoyance: emp.prevoyance || '',
        hiredAt: ymd(emp.hiredAt),
        endedAt: ymd(emp.endedAt),
        trialEndAt: ymd(emp.trialEndAt),
        iban: emp.iban || '',
        bic: emp.bic || '',
        socialSecurityNumber: emp.socialSecurityNumber || '',
        emergencyContact: emp.emergencyContact || '',
        emergencyPhone: emp.emergencyPhone || '',
        status: emp.status || 'active',
        sensitiveNotes: emp.sensitiveNotes || '',
        rhNotes: emp.rhNotes || '',
      });
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  function setField(key: string, value: string | number) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function save(keys?: string[]) {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      const source = keys || Object.keys(form);
      for (const k of source) {
        body[k] = form[k] === '' ? null : form[k];
      }
      await api(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setMsg('Fiche RH enregistrée');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addBonus() {
    setBusy(true);
    setErr('');
    try {
      await api('/hr/bonuses', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: id,
          ...bonusForm,
          yearMonth:
            bonusForm.kind === 'one_shot' ? bonusForm.yearMonth : undefined,
        }),
      });
      setMsg('Prime ajoutée');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivateBonus(bonusId: string) {
    await api(`/hr/bonuses/${bonusId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
    await load();
  }

  async function generatePayslip() {
    setBusy(true);
    setErr('');
    try {
      await api('/hr/payslips/generate', {
        method: 'POST',
        body: JSON.stringify({
          yearMonth: currentYearMonth(),
          employeeId: id,
          overwriteDraft: true,
        }),
      });
      setMsg(`Bulletin ${currentYearMonth()} généré / mis à jour`);
      await load();
      setTab('payslips');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!e && !err) {
    return <p className="text-sm text-[var(--muted)]">Chargement…</p>;
  }
  if (!e) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
        {err}
      </div>
    );
  }

  const seniorityYears = e.hiredAt
    ? Math.max(
        0,
        (Date.now() - new Date(e.hiredAt).getTime()) /
          (365.25 * 24 * 3600 * 1000),
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/employees" className="text-xs text-action">
            ← Salariés
          </Link>
          <h1 className="text-2xl font-bold">
            {e.lastName} {e.firstName}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {e.matricule} · {e.jobTitle || '—'} · {e.depot?.name || 'Sans dépôt'}
            {e.contractType ? ` · ${e.contractType}` : ''}
            {seniorityYears != null
              ? ` · ${seniorityYears.toFixed(1)} ans d’ancienneté`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.driver && (
            <Link
              href={`/app/drivers/${e.driver.id}`}
              className="btn-secondary"
            >
              Fiche exploitation
            </Link>
          )}
          <Link
            href="/app/hr/payroll"
            className="btn-ghost border border-[var(--border)]"
          >
            Module paie
          </Link>
          <Link
            href="/app/hr/leaves"
            className="btn-ghost border border-[var(--border)]"
          >
            Congés
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Statut', e.status],
          ['Salaire base', fmtEur(e.baseMonthlySalary)],
          [
            'Compte',
            e.accountLink?.user.status || 'non créé',
          ],
          [
            'Bulletins',
            String(e.payslips?.length ?? 0),
          ],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <div className="text-[10px] uppercase text-[var(--muted)]">{l}</div>
            <div className="text-sm font-semibold">{v}</div>
          </div>
        ))}
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

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {TABS.map(([k, label]) => (
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
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
              Identité civile
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Nom"
                value={String(form.lastName || '')}
                onChange={(v) => setField('lastName', v)}
              />
              <Field
                label="Prénom"
                value={String(form.firstName || '')}
                onChange={(v) => setField('firstName', v)}
              />
              <Field
                label="Date de naissance"
                type="date"
                value={String(form.birthDate || '')}
                onChange={(v) => setField('birthDate', v)}
              />
              <Field
                label="Lieu de naissance"
                value={String(form.birthPlace || '')}
                onChange={(v) => setField('birthPlace', v)}
              />
              <Field
                label="Nationalité"
                value={String(form.nationality || '')}
                onChange={(v) => setField('nationality', v)}
              />
              <label className="block text-xs">
                Situation familiale
                <select
                  className="input mt-1"
                  value={String(form.familyStatus || '')}
                  onChange={(e) => setField('familyStatus', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="celibataire">Célibataire</option>
                  <option value="marie">Marié(e)</option>
                  <option value="pacse">Pacsé(e)</option>
                  <option value="divorce">Divorcé(e)</option>
                  <option value="veuf">Veuf / veuve</option>
                </select>
              </label>
              <Field
                label="Nb personnes à charge"
                type="number"
                value={String(form.dependentsCount ?? 0)}
                onChange={(v) => setField('dependentsCount', Number(v))}
              />
              <Field
                label="N° sécurité sociale"
                value={String(form.socialSecurityNumber || '')}
                onChange={(v) => setField('socialSecurityNumber', v)}
                disabled={!!e._sensitiveHidden}
              />
            </div>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
              Coordonnées & urgence
            </h2>
            <Field
              label="Email pro"
              value={String(form.email || '')}
              onChange={(v) => setField('email', v)}
            />
            <Field
              label="Téléphone"
              value={String(form.phone || '')}
              onChange={(v) => setField('phone', v)}
            />
            <Field
              label="Adresse"
              value={String(form.addressLine1 || '')}
              onChange={(v) => setField('addressLine1', v)}
            />
            <Field
              label="Complément"
              value={String(form.addressLine2 || '')}
              onChange={(v) => setField('addressLine2', v)}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="CP"
                value={String(form.postalCode || '')}
                onChange={(v) => setField('postalCode', v)}
              />
              <Field
                label="Ville"
                value={String(form.city || '')}
                onChange={(v) => setField('city', v)}
              />
              <Field
                label="Pays"
                value={String(form.country || '')}
                onChange={(v) => setField('country', v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Contact urgence"
                value={String(form.emergencyContact || '')}
                onChange={(v) => setField('emergencyContact', v)}
              />
              <Field
                label="Tél. urgence"
                value={String(form.emergencyPhone || '')}
                onChange={(v) => setField('emergencyPhone', v)}
              />
            </div>
            {e._sensitiveHidden && (
              <p className="text-xs text-amber-800">
                Certaines données sensibles sont masquées (permission
                hr:sensitive:read requise).
              </p>
            )}
          </section>

          <div className="lg:col-span-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                save([
                  'firstName',
                  'lastName',
                  'email',
                  'phone',
                  'birthDate',
                  'birthPlace',
                  'nationality',
                  'familyStatus',
                  'dependentsCount',
                  'socialSecurityNumber',
                  'addressLine1',
                  'addressLine2',
                  'postalCode',
                  'city',
                  'country',
                  'emergencyContact',
                  'emergencyPhone',
                ])
              }
            >
              Enregistrer l’identité
            </button>
          </div>
        </div>
      )}

      {tab === 'contract' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
              Contrat de travail
            </h2>
            <Field
              label="Poste / emploi"
              value={String(form.jobTitle || '')}
              onChange={(v) => setField('jobTitle', v)}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                Type de contrat
                <select
                  className="input mt-1"
                  value={String(form.contractType || 'CDI')}
                  onChange={(e) => setField('contractType', e.target.value)}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="interim">Intérim</option>
                  <option value="apprenti">Apprentissage</option>
                  <option value="saisonnier">Saisonnier</option>
                </select>
              </label>
              <label className="block text-xs">
                Temps de travail
                <select
                  className="input mt-1"
                  value={String(form.workTimeType || 'Temps plein')}
                  onChange={(e) => setField('workTimeType', e.target.value)}
                >
                  <option value="Temps plein">Temps plein</option>
                  <option value="Temps partiel">Temps partiel</option>
                  <option value="Intermittent">Intermittent</option>
                </select>
              </label>
              <Field
                label="Classification"
                value={String(form.classification || '')}
                onChange={(v) => setField('classification', v)}
              />
              <Field
                label="Échelon"
                value={String(form.echelon || '')}
                onChange={(v) => setField('echelon', v)}
              />
              <Field
                label="Coefficient"
                value={String(form.jobCoefficient || '')}
                onChange={(v) => setField('jobCoefficient', v)}
              />
              <label className="block text-xs">
                Statut RH
                <select
                  className="input mt-1"
                  value={String(form.status || 'active')}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  <option value="active">Actif</option>
                  <option value="trial">Période d’essai</option>
                  <option value="suspended">Suspendu</option>
                  <option value="left">Parti</option>
                </select>
              </label>
            </div>
            <Field
              label="Convention collective"
              value={String(form.collectiveAgreement || '')}
              onChange={(v) => setField('collectiveAgreement', v)}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field
                label="Embauche"
                type="date"
                value={String(form.hiredAt || '')}
                onChange={(v) => setField('hiredAt', v)}
              />
              <Field
                label="Fin essai"
                type="date"
                value={String(form.trialEndAt || '')}
                onChange={(v) => setField('trialEndAt', v)}
              />
              <Field
                label="Fin de contrat"
                type="date"
                value={String(form.endedAt || '')}
                onChange={(v) => setField('endedAt', v)}
              />
            </div>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
              Couverture & notes RH
            </h2>
            <Field
              label="Mutuelle"
              value={String(form.mutuelle || '')}
              onChange={(v) => setField('mutuelle', v)}
            />
            <Field
              label="Prévoyance"
              value={String(form.prevoyance || '')}
              onChange={(v) => setField('prevoyance', v)}
            />
            <label className="block text-xs">
              Notes RH (non sensibles)
              <textarea
                className="input mt-1 min-h-[80px]"
                value={String(form.rhNotes || '')}
                onChange={(e) => setField('rhNotes', e.target.value)}
              />
            </label>
            <label className="block text-xs">
              Notes sensibles
              <textarea
                className="input mt-1 min-h-[80px]"
                value={String(form.sensitiveNotes || '')}
                disabled={!!e._sensitiveHidden}
                onChange={(e) => setField('sensitiveNotes', e.target.value)}
              />
            </label>
            {e.driver && (
              <p className="rounded-lg bg-[var(--surface-2)] p-3 text-xs">
                Conducteur lié — permis, FCO, médical et planning se gèrent dans{' '}
                <Link
                  href={`/app/drivers/${e.driver.id}`}
                  className="text-action underline"
                >
                  Exploitation → Conducteurs
                </Link>
                .
              </p>
            )}
          </section>

          <div className="lg:col-span-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                save([
                  'jobTitle',
                  'contractType',
                  'workTimeType',
                  'classification',
                  'echelon',
                  'jobCoefficient',
                  'status',
                  'collectiveAgreement',
                  'hiredAt',
                  'trialEndAt',
                  'endedAt',
                  'mutuelle',
                  'prevoyance',
                  'rhNotes',
                  'sensitiveNotes',
                ])
              }
            >
              Enregistrer le contrat
            </button>
          </div>
        </div>
      )}

      {tab === 'pay' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
              Rémunération de base
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Heures / mois"
                type="number"
                value={String(form.contractHours ?? '')}
                onChange={(v) => setField('contractHours', Number(v))}
              />
              <Field
                label="Heures / semaine"
                type="number"
                value={String(form.weeklyHours ?? '')}
                onChange={(v) => setField('weeklyHours', Number(v))}
              />
              <Field
                label="Taux horaire €"
                type="number"
                value={String(form.baseHourlyRate ?? '')}
                onChange={(v) => setField('baseHourlyRate', Number(v))}
              />
              <Field
                label="Salaire mensuel brut €"
                type="number"
                value={String(form.baseMonthlySalary ?? '')}
                onChange={(v) => setField('baseMonthlySalary', Number(v))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="IBAN"
                value={String(form.iban || '')}
                onChange={(v) => setField('iban', v)}
                disabled={!!e._sensitiveHidden}
              />
              <Field
                label="BIC"
                value={String(form.bic || '')}
                onChange={(v) => setField('bic', v)}
                disabled={!!e._sensitiveHidden}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                save([
                  'contractHours',
                  'weeklyHours',
                  'baseHourlyRate',
                  'baseMonthlySalary',
                  'iban',
                  'bic',
                ])
              }
            >
              Enregistrer la rémunération
            </button>
          </section>

          <section className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
                Primes & indemnités
              </h2>
              <Link href="/app/hr/payroll" className="text-xs text-action">
                Paie globale
              </Link>
            </div>
            <ul className="space-y-2 text-sm">
              {(e.bonuses || []).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div>
                    <div className="font-medium">
                      {b.label}{' '}
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {b.code}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {b.kind === 'recurring' ? 'Récurrente' : `Ponctuelle ${b.yearMonth || ''}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="tabular-nums">{fmtEur(b.amount)}</strong>
                    <button
                      type="button"
                      className="text-xs text-rose-600"
                      onClick={() => deactivateBonus(b.id)}
                    >
                      Désactiver
                    </button>
                  </div>
                </li>
              ))}
              {!e.bonuses?.length && (
                <li className="text-xs text-[var(--muted)]">Aucune prime active</li>
              )}
            </ul>
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
              <Field
                label="Code"
                value={bonusForm.code}
                onChange={(v) => setBonusForm((s) => ({ ...s, code: v }))}
              />
              <Field
                label="Montant €"
                type="number"
                value={String(bonusForm.amount)}
                onChange={(v) =>
                  setBonusForm((s) => ({ ...s, amount: Number(v) }))
                }
              />
              <div className="col-span-2">
                <Field
                  label="Libellé"
                  value={bonusForm.label}
                  onChange={(v) => setBonusForm((s) => ({ ...s, label: v }))}
                />
              </div>
              <label className="block text-xs">
                Type
                <select
                  className="input mt-1"
                  value={bonusForm.kind}
                  onChange={(e) =>
                    setBonusForm((s) => ({ ...s, kind: e.target.value }))
                  }
                >
                  <option value="recurring">Récurrente</option>
                  <option value="one_shot">Ponctuelle</option>
                </select>
              </label>
              {bonusForm.kind === 'one_shot' && (
                <Field
                  label="Mois YYYY-MM"
                  value={bonusForm.yearMonth}
                  onChange={(v) =>
                    setBonusForm((s) => ({ ...s, yearMonth: v }))
                  }
                />
              )}
            </div>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={addBonus}
            >
              Ajouter une prime
            </button>
          </section>
        </div>
      )}

      {tab === 'payslips' && (
        <section className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold">Bulletins de paie</h2>
              <p className="text-xs text-[var(--muted)]">
                Générés depuis les heures planning, le salaire de base et les
                primes
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={generatePayslip}
              >
                Générer {currentYearMonth()}
              </button>
              <Link
                href={`/app/hr/payroll?ym=${currentYearMonth()}`}
                className="btn-ghost border border-[var(--border)]"
              >
                Module paie
              </Link>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#f8fafc] text-[10px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Période</th>
                <th className="px-3 py-2 text-right">Heures</th>
                <th className="px-3 py-2 text-right">HS</th>
                <th className="px-3 py-2 text-right">Brut</th>
                <th className="px-3 py-2 text-right">Charges sal.</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(e.payslips || []).map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">{p.yearMonth}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtHours(p.workedHours)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtHours(p.overtimeHours)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtEur(p.grossAmount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtEur(p.employeeCharges)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {fmtEur(p.netAmount)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {PAYSLIP_STATUS[p.status] || p.status}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-xs text-action"
                      onClick={() =>
                        openPrintHtml(
                          `/documents/print/payslip/${p.id}`,
                        ).catch((e) => setErr(e.message))
                      }
                    >
                      PDF
                    </button>
                    <Link
                      href={`/app/hr/payroll/${p.id}`}
                      className="text-xs text-action"
                    >
                      Ouvrir
                    </Link>
                  </td>
                </tr>
              ))}
              {!e.payslips?.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-[var(--muted)]"
                  >
                    Aucun bulletin — générez pour le mois en cours ou depuis le
                    module Paie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'leaves' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
                Soldes
              </h2>
              <Link href="/app/hr/leaves" className="text-xs text-action">
                Gérer →
              </Link>
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
                {(e.leaveBalances || []).map((b) => (
                  <tr key={b.id} className="border-t border-[var(--border)]">
                    <td className="py-1.5">
                      {LEAVE_TYPES[b.type] || b.type}{' '}
                      <span className="text-[10px] text-[var(--muted)]">
                        {b.year}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {b.entitled}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{b.used}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">
                      {b.remaining}
                    </td>
                  </tr>
                ))}
                {!e.leaveBalances?.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-xs text-[var(--muted)]"
                    >
                      Aucun solde initialisé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold uppercase text-[var(--muted)]">
              Demandes récentes
            </h2>
            <ul className="space-y-2 text-sm">
              {(e.leaveRequests || []).map((l) => (
                <li
                  key={l.id}
                  className="flex justify-between gap-2 border-b border-[var(--border)] pb-2"
                >
                  <span>
                    {LEAVE_TYPES[l.type] || l.type} ·{' '}
                    {new Date(l.startsOn).toLocaleDateString('fr-FR')} →{' '}
                    {new Date(l.endsOn).toLocaleDateString('fr-FR')}
                  </span>
                  <span className="text-xs">
                    {LEAVE_STATUS[l.status] || l.status}
                  </span>
                </li>
              ))}
              {!e.leaveRequests?.length && (
                <li className="text-xs text-[var(--muted)]">Aucune demande</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === 'career' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
                Formations
              </h2>
              <Link href="/app/hr/trainings" className="text-xs text-action">
                Catalogue →
              </Link>
            </div>
            <ul className="space-y-2 text-sm">
              {(e.enrollments || []).map((en) => (
                <li
                  key={en.id}
                  className="rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="font-medium">
                    {en.session.course.code} — {en.session.course.title}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {new Date(en.session.startsAt).toLocaleDateString('fr-FR')}
                    {en.session.location ? ` · ${en.session.location}` : ''} ·{' '}
                    {en.status}
                  </div>
                </li>
              ))}
              {!e.enrollments?.length && (
                <li className="text-xs text-[var(--muted)]">
                  Aucune inscription formation
                </li>
              )}
            </ul>
          </section>
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-[var(--muted)]">
                Entretiens RH
              </h2>
              <Link href="/app/hr/interviews" className="text-xs text-action">
                Planning →
              </Link>
            </div>
            <ul className="space-y-2 text-sm">
              {(e.interviews || []).map((iv) => (
                <li
                  key={iv.id}
                  className="rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="font-medium">{iv.title}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {INTERVIEW_KINDS[iv.kind] || iv.kind} · {iv.status}
                    {iv.scheduledAt
                      ? ` · ${new Date(iv.scheduledAt).toLocaleDateString('fr-FR')}`
                      : ''}
                  </div>
                  {iv.objectives && (
                    <p className="mt-1 text-xs">{iv.objectives}</p>
                  )}
                </li>
              ))}
              {!e.interviews?.length && (
                <li className="text-xs text-[var(--muted)]">Aucun entretien</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === 'access' && <AccessTab employeeId={e.id} />}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs">
      {label}
      <input
        className="input mt-1"
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
