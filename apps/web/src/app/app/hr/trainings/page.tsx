'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Course = {
  id: string;
  code: string;
  title: string;
  category: string;
  durationHours: number;
  mandatory: boolean;
  validityMonths?: number | null;
  _count: { sessions: number };
};

type Session = {
  id: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  provider?: string | null;
  capacity: number;
  status: string;
  course: { id: string; title: string; category: string };
  enrollments: Array<{
    id: string;
    status: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      matricule: string;
    };
  }>;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
};

export default function HrTrainingsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [enroll, setEnroll] = useState({ sessionId: '', employeeId: '' });
  const [courseForm, setCourseForm] = useState({
    code: '',
    title: '',
    category: 'FCO',
    durationHours: 7,
    mandatory: true,
  });

  function reload() {
    return Promise.all([
      api<Course[]>('/hr/trainings/courses'),
      api<Session[]>('/hr/trainings/sessions'),
      api<Employee[]>('/employees'),
    ]).then(([c, s, e]) => {
      setCourses(c);
      setSessions(s);
      setEmployees(e);
    });
  }

  useEffect(() => {
    reload().catch((e) => setErr(e.message));
  }, []);

  async function createCourse() {
    setErr('');
    setOk('');
    try {
      await api('/hr/trainings/courses', {
        method: 'POST',
        body: JSON.stringify(courseForm),
      });
      setOk('Formation ajoutée au catalogue');
      setCourseForm({
        code: '',
        title: '',
        category: 'FCO',
        durationHours: 7,
        mandatory: true,
      });
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function createSession(courseId: string) {
    const starts = new Date();
    starts.setDate(starts.getDate() + 30);
    const ends = new Date(starts);
    ends.setDate(ends.getDate() + 1);
    try {
      await api('/hr/trainings/sessions', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          startsAt: starts.toISOString(),
          endsAt: ends.toISOString(),
          location: 'À préciser',
          capacity: 12,
        }),
      });
      setOk('Session créée');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function doEnroll() {
    if (!enroll.sessionId || !enroll.employeeId) return;
    try {
      await api(`/hr/trainings/sessions/${enroll.sessionId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ employeeId: enroll.employeeId }),
      });
      setOk('Inscription enregistrée');
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function markResult(enrollmentId: string, status: string) {
    try {
      await api(`/hr/trainings/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setOk(`Statut → ${status}`);
      await reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="page-kicker">Module RH</p>
        <h1 className="text-2xl font-bold">Formations & FCO</h1>
        <p className="text-sm text-[var(--muted)]">
          Catalogue, sessions, inscriptions — mise à jour automatique FCO
          conducteur si réussite
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase text-[var(--muted)]">
            Catalogue
          </h2>
          <ul className="mb-4 space-y-2 text-sm">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-2"
              >
                <div>
                  <div className="font-medium">
                    {c.code} — {c.title}
                    {c.mandatory && (
                      <span className="ml-1 text-[10px] text-rose-600">
                        OBLIGATOIRE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {c.category} · {c.durationHours} h · {c._count.sessions}{' '}
                    session(s)
                    {c.validityMonths
                      ? ` · validité ${c.validityMonths} mois`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => createSession(c.id)}
                >
                  + Session
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">
              Nouvelle formation
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="input w-24 text-sm"
                placeholder="Code"
                value={courseForm.code}
                onChange={(e) =>
                  setCourseForm((s) => ({ ...s, code: e.target.value }))
                }
              />
              <input
                className="input min-w-[10rem] flex-1 text-sm"
                placeholder="Titre"
                value={courseForm.title}
                onChange={(e) =>
                  setCourseForm((s) => ({ ...s, title: e.target.value }))
                }
              />
              <select
                className="input w-auto text-sm"
                value={courseForm.category}
                onChange={(e) =>
                  setCourseForm((s) => ({ ...s, category: e.target.value }))
                }
              >
                <option value="FCO">FCO</option>
                <option value="permis">Permis</option>
                <option value="securite">Sécurité</option>
                <option value="metier">Métier</option>
                <option value="management">Management</option>
              </select>
              <button type="button" className="btn-secondary" onClick={createCourse}>
                Ajouter
              </button>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase text-[var(--muted)]">
            Inscrire un salarié
          </h2>
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              className="input min-w-[12rem] flex-1 text-sm"
              value={enroll.sessionId}
              onChange={(e) =>
                setEnroll((s) => ({ ...s, sessionId: e.target.value }))
              }
            >
              <option value="">Session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course.title} —{' '}
                  {new Date(s.startsAt).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
            <select
              className="input min-w-[10rem] flex-1 text-sm"
              value={enroll.employeeId}
              onChange={(e) =>
                setEnroll((s) => ({ ...s, employeeId: e.target.value }))
              }
            >
              <option value="">Salarié…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.lastName} {e.firstName} ({e.matricule})
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary" onClick={doEnroll}>
              Inscrire
            </button>
          </div>

          <h2 className="mb-2 text-sm font-bold uppercase text-[var(--muted)]">
            Sessions
          </h2>
          <ul className="space-y-3 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="font-medium">{s.course.title}</div>
                <div className="text-xs text-[var(--muted)]">
                  {new Date(s.startsAt).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(s.endsAt).toLocaleDateString('fr-FR')} ·{' '}
                  {s.location || '—'} · {s.provider || '—'} ·{' '}
                  {s.enrollments.length}/{s.capacity}
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {s.enrollments.map((en) => (
                    <li
                      key={en.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {en.employee.lastName} {en.employee.firstName} —{' '}
                        <em>{en.status}</em>
                      </span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2 py-0.5 text-[10px]"
                          onClick={() => markResult(en.id, 'present')}
                        >
                          Présent
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-0.5 text-[10px]"
                          onClick={() => markResult(en.id, 'reussi')}
                        >
                          Réussi
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-0.5 text-[10px]"
                          onClick={() => markResult(en.id, 'absent')}
                        >
                          Absent
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
