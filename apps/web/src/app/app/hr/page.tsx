'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmtEur, INTERVIEW_KINDS } from '@/lib/hr';

type Cockpit = {
  yearMonth: string;
  kpis: {
    employeesActive: number;
    driversActive: number;
    leavesPending: number;
    interviewsPlanned: number;
    trainingsOpen: number;
    payslipsDraft: number;
    payrollGross: number;
    payrollNet: number;
    complianceAlerts: number;
    fcoSoon: number;
    medicalSoon: number;
    licenseSoon: number;
  };
  upcomingInterviews: Array<{
    id: string;
    title: string;
    kind: string;
    scheduledAt?: string | null;
    employee: { firstName: string; lastName: string; matricule: string };
  }>;
  upcomingSessions: Array<{
    id: string;
    startsAt: string;
    location?: string | null;
    course: { title: string; category: string };
    _count: { enrollments: number };
  }>;
};

export default function HrCockpitPage() {
  const [data, setData] = useState<Cockpit | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Cockpit>('/hr/cockpit')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-[var(--muted)]">Chargement RH…</p>;
  }

  const k = data.kpis;
  const cards = [
    { label: 'Salariés actifs', value: k.employeesActive, href: '/app/employees' },
    { label: 'Conducteurs', value: k.driversActive, href: '/app/drivers' },
    { label: 'Congés en attente', value: k.leavesPending, href: '/app/hr/leaves' },
    { label: 'Entretiens à venir', value: k.interviewsPlanned, href: '/app/hr/interviews' },
    { label: 'Sessions formation', value: k.trainingsOpen, href: '/app/hr/trainings' },
    { label: 'Fiches paie brouillon', value: k.payslipsDraft, href: '/app/hr/payroll' },
    {
      label: 'Masse salariale brute',
      value: fmtEur(k.payrollGross),
      href: '/app/hr/payroll',
    },
    {
      label: 'Alertes conformité',
      value: k.complianceAlerts,
      href: '/app/drivers',
      hint: `FCO ${k.fcoSoon} · Médical ${k.medicalSoon} · Permis ${k.licenseSoon}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Ressources humaines</p>
          <h1 className="text-2xl font-bold">Cockpit RH transporteur</h1>
          <p className="text-sm text-[var(--muted)]">
            Paie (bulletins depuis heures planning), primes, congés, FCO,
            entretiens — salariés RH reliés à l’exploitation · {data.yearMonth}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/hr/payroll" className="btn-primary">
            Paie & bulletins
          </Link>
          <Link href="/app/hr/bonuses" className="btn-secondary">
            Primes
          </Link>
          <Link href="/app/hr/leaves" className="btn-secondary">
            Congés
          </Link>
          <Link href="/app/employees" className="btn-secondary">
            Salariés
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card block p-4 transition hover:border-action/40"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {c.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{c.value}</div>
            {'hint' in c && c.hint && (
              <div className="mt-1 text-[11px] text-[var(--muted)]">{c.hint}</div>
            )}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
              Prochains entretiens
            </h2>
            <Link href="/app/hr/interviews" className="text-xs text-action">
              Tout voir
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {data.upcomingInterviews.map((i) => (
              <li
                key={i.id}
                className="flex justify-between gap-2 border-b border-[var(--border)] pb-2"
              >
                <div>
                  <div className="font-medium">
                    {i.employee.lastName} {i.employee.firstName}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {INTERVIEW_KINDS[i.kind] || i.kind} · {i.title}
                  </div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                  {i.scheduledAt
                    ? new Date(i.scheduledAt).toLocaleDateString('fr-FR')
                    : '—'}
                </div>
              </li>
            ))}
            {!data.upcomingInterviews.length && (
              <li className="text-[var(--muted)]">Aucun entretien planifié.</li>
            )}
          </ul>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
              Formations à venir
            </h2>
            <Link href="/app/hr/trainings" className="text-xs text-action">
              Catalogue
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {data.upcomingSessions.map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-2 border-b border-[var(--border)] pb-2"
              >
                <div>
                  <div className="font-medium">{s.course.title}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {s.course.category} · {s.location || 'Lieu à préciser'} ·{' '}
                    {s._count.enrollments} inscrit(s)
                  </div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                  {new Date(s.startsAt).toLocaleDateString('fr-FR')}
                </div>
              </li>
            ))}
            {!data.upcomingSessions.length && (
              <li className="text-[var(--muted)]">Aucune session ouverte.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
