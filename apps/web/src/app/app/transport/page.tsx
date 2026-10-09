'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function TransportPage() {
  const [tab, setTab] = useState<'lieux' | 'calendriers' | 'courses' | 'services' | 'itineraires'>('courses');
  const [locations, setLocations] = useState<Array<{ id: string; name: string; type: string; city?: string }>>([]);
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string; kind: string; oddEven: string }>>([]);
  const [courses, setCourses] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      segments: Array<{ name: string }>;
      operations: Array<{ label: string; kind: string }>;
    }>
  >([]);
  const [services, setServices] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      courseLinks: Array<{ course: { code: string; name: string } }>;
    }>
  >([]);
  const [itineraries, setItineraries] = useState<
    Array<{ id: string; code: string; name: string; distanceKm?: number; stopsJson: string }>
  >([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [locForm, setLocForm] = useState({ name: '', type: 'stop', city: '' });
  const [courseForm, setCourseForm] = useState({ code: '', name: '' });
  const [svcForm, setSvcForm] = useState({ code: '', name: '', courseId: '' });
  const [msg, setMsg] = useState('');

  const load = () => {
    api('/locations').then(setLocations);
    api('/calendars').then(setCalendars);
    api('/courses').then((c) => {
      setCourses(c);
      if (c[0] && !svcForm.courseId) setSvcForm((f) => ({ ...f, courseId: c[0].id }));
    });
    api('/services').then(setServices);
    api('/itineraries').then(setItineraries);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;
    api(`/courses/${selectedCourse}/detail`).then(setDetail);
  }, [selectedCourse]);

  async function addLocation(e: FormEvent) {
    e.preventDefault();
    await api('/locations', { method: 'POST', body: JSON.stringify(locForm) });
    setLocForm({ name: '', type: 'stop', city: '' });
    setMsg('Lieu créé');
    load();
  }

  async function addCourse(e: FormEvent) {
    e.preventDefault();
    const created = await api<{ id: string }>('/courses', {
      method: 'POST',
      body: JSON.stringify({
        ...courseForm,
        segments: [
          { sequence: 1, name: 'Départ', kind: 'start', plannedTime: '07:00' },
          { sequence: 2, name: 'Arrivée', kind: 'stop', plannedTime: '08:00' },
        ],
      }),
    });
    await api(`/courses/${created.id}/operations`, {
      method: 'POST',
      body: JSON.stringify({
        sequence: 1,
        kind: 'run',
        label: 'Opération principale',
        plannedStart: '07:00',
        plannedEnd: '08:00',
        durationMin: 60,
      }),
    });
    setMsg('Course + opération créées');
    setCourseForm({ code: '', name: '' });
    load();
  }

  async function addService(e: FormEvent) {
    e.preventDefault();
    await api('/services', {
      method: 'POST',
      body: JSON.stringify({
        code: svcForm.code,
        name: svcForm.name,
        courseIds: svcForm.courseId ? [svcForm.courseId] : [],
      }),
    });
    setMsg('Service groupé créé');
    load();
  }

  async function addItinerary() {
    await api('/itineraries', {
      method: 'POST',
      body: JSON.stringify({
        code: `IT-${Date.now().toString(36)}`,
        name: 'Nouvel itinéraire',
        distanceKm: 12,
        durationMin: 30,
        stops: locations.slice(0, 2).map((l) => ({ name: l.name })),
      }),
    });
    setMsg('Itinéraire créé');
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plan de transport — données</h1>
        <p className="text-sm text-[var(--muted)]">
          Lieux, calendriers, courses/opérations/segments, services, itinéraires.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['lieux', 'Lieux'],
            ['calendriers', 'Calendriers'],
            ['courses', 'Courses'],
            ['services', 'Services'],
            ['itineraires', 'Itinéraires'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'lieux' && (
        <div className="space-y-3">
          <form onSubmit={addLocation} className="card grid gap-3 p-4 md:grid-cols-4">
            <input className="input" placeholder="Nom" value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} required />
            <select className="input" value={locForm.type} onChange={(e) => setLocForm({ ...locForm, type: e.target.value })}>
              <option value="depot">Dépôt</option>
              <option value="stop">Arrêt</option>
              <option value="school">École</option>
              <option value="station">Gare</option>
            </select>
            <input className="input" placeholder="Ville" value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} />
            <button className="btn-primary">Ajouter lieu</button>
          </form>
          <div className="card divide-y divide-[var(--border)]">
            {locations.map((l) => (
              <button
                key={l.id}
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-action/5"
                onClick={() => setMsg(`Lieu sélectionné : ${l.name}`)}
              >
                <span className="font-medium">{l.name}</span>
                <span className="text-[var(--muted)]">
                  {l.type} · {l.city || '—'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'calendriers' && (
        <div className="card divide-y divide-[var(--border)]">
          {calendars.map((c) => (
            <div key={c.id} className="px-4 py-3 text-sm">
              <div className="font-semibold">{c.name}</div>
              <div className="text-[var(--muted)]">
                {c.kind} · semaines {c.oddEven}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'courses' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <form onSubmit={addCourse} className="card grid gap-3 p-4">
              <input className="input" placeholder="Code" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} required />
              <input className="input" placeholder="Nom" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} required />
              <button className="btn-primary">Créer course</button>
            </form>
            <div className="card divide-y divide-[var(--border)]">
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCourse(c.id)}
                  className={`block w-full px-4 py-3 text-left text-sm hover:bg-action/5 ${
                    selectedCourse === c.id ? 'bg-action/10' : ''
                  }`}
                >
                  <div className="font-semibold">
                    {c.code} — {c.name}
                  </div>
                  <div className="text-[var(--muted)]">
                    {c.segments.length} segments · {c.operations?.length || 0} opérations
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h2 className="font-semibold">Détail course</h2>
            {!detail && <p className="mt-2 text-sm text-[var(--muted)]">Sélectionnez une course.</p>}
            {detail && (
              <pre className="mt-2 max-h-[480px] overflow-auto text-[10px]">
                {JSON.stringify(detail, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {tab === 'services' && (
        <div className="space-y-3">
          <form onSubmit={addService} className="card grid gap-3 p-4 md:grid-cols-4">
            <input className="input" placeholder="Code" value={svcForm.code} onChange={(e) => setSvcForm({ ...svcForm, code: e.target.value })} required />
            <input className="input" placeholder="Nom" value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} required />
            <select className="input" value={svcForm.courseId} onChange={(e) => setSvcForm({ ...svcForm, courseId: e.target.value })}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
            <button className="btn-primary">Grouper en service</button>
          </form>
          {services.map((s) => (
            <div key={s.id} className="card p-4 text-sm">
              <div className="font-semibold">
                {s.code} — {s.name}
              </div>
              <div className="text-[var(--muted)]">
                Courses : {s.courseLinks.map((l) => l.course.code).join(' → ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'itineraires' && (
        <div className="space-y-3">
          <button className="btn-primary" onClick={addItinerary}>
            Créer itinéraire depuis lieux
          </button>
          {itineraries.map((i) => (
            <div key={i.id} className="card p-4 text-sm">
              <div className="font-semibold">
                {i.code} — {i.name}
              </div>
              <div className="text-[var(--muted)]">{i.distanceKm} km</div>
              <div className="text-xs">{i.stopsJson}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
