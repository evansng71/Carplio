'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Assignment } from '../../lib';
import { fmtDayLong, fmtTime } from '../../lib';

type DayData = {
  date: string;
  assignments: Assignment[];
  rests: Array<{ id: string; kind: string; startsAt: string; endsAt: string }>;
  leave?: { type: string; status: string } | null;
};

export default function DriverDayPage() {
  const { date } = useParams<{ date: string }>();
  const [data, setData] = useState<DayData | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const focus =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('a')
        : null;
    api<DayData>(`/portal/me/today?date=${date}`)
      .then((d) => {
        setData(d);
        setOpenId(focus || d.assignments[0]?.id || null);
      })
      .catch((e) => setErr(e.message));
  }, [date]);

  const assignments = data?.assignments || [];

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="bg-white px-4 pb-3 pt-3">
        <Link
          href="/conducteur/planning"
          className="inline-flex text-[var(--drv-red)]"
          aria-label="Retour"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{fmtDayLong(date)}</h1>
      </div>

      <div className="space-y-3 px-4 py-4">
        {(err || note) && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {err || note}
          </div>
        )}

        {assignments.map((a, i) => {
          const open = openId === a.id;
          const m = a.mission;
          return (
            <article key={a.id} className="drv-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 p-4 text-left"
                onClick={() => setOpenId(open ? null : a.id)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">
                      Service {m.number || m.title}
                    </h2>
                    {assignments.length > 1 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold">
                        {i + 1}/{assignments.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    <TimeRow
                      time={fmtTime(a.startsAt)}
                      place={m.origin || 'Dépôt'}
                      clock
                    />
                    <TimeRow
                      time={fmtTime(a.endsAt)}
                      place={m.destination || m.origin || 'Dépôt'}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-[var(--drv-red)]">
                  {open ? 'Masquer le détail' : 'Voir le détail'}
                </span>
              </button>

              {open && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-2">
                  <TimelineDetail assignment={a} />
                  <button
                    type="button"
                    className="drv-btn-black mt-4"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api('/portal/me/service-event', {
                          method: 'POST',
                          body: JSON.stringify({
                            kind: 'service_start',
                            missionId: m.id,
                          }),
                        });
                        setNote('Prise de service enregistrée');
                      } catch (e) {
                        setErr((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Prise de service
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {!assignments.length && (
          <div className="drv-card p-6 text-center">
            <p className="font-semibold">Aucun service ce jour</p>
            {data?.rests?.length ? (
              <p className="mt-1 text-sm text-[var(--drv-muted)]">Repos prévu</p>
            ) : null}
            {data?.leave ? (
              <p className="mt-1 text-sm text-[var(--drv-muted)]">
                Absence : {data.leave.type}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeRow({
  time,
  place,
  clock,
}: {
  time: string;
  place: string;
  clock?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-1 h-2.5 w-2.5 rounded-full ${
          clock ? 'bg-blue-500' : 'bg-[var(--drv-red)]'
        }`}
      />
      <div>
        <div className="text-base font-bold">{time}</div>
        <div className="text-[11px] font-semibold uppercase text-[var(--drv-muted)]">
          {place}
        </div>
      </div>
    </div>
  );
}

function TimelineDetail({ assignment }: { assignment: Assignment }) {
  const m = assignment.mission;
  const steps = useMemo(() => {
    const items: Array<{
      time: string;
      title: string;
      place: string;
      tag?: string;
    }> = [];
    const start = assignment.startsAt;
    items.push({
      time: fmtTime(m.garageDepartureAt || start),
      title: 'PRISE DE SERVICE',
      place: m.origin || 'Dépôt',
      tag: m.order?.customer?.name
        ? `Ligne / ${m.order.customer.name}`
        : m.title,
    });
    if (m.presentationAt) {
      items.push({
        time: fmtTime(m.presentationAt),
        title: 'HAUT LE PIED',
        place: m.origin || 'Dépôt',
      });
    }
    items.push({
      time: fmtTime(start),
      title: 'DÉPART SERVICE',
      place: m.origin || '—',
      tag: m.title,
    });
    items.push({
      time: fmtTime(assignment.endsAt),
      title: 'FIN DE SERVICE',
      place: m.destination || m.origin || '—',
    });
    if (m.returnGarageAt) {
      items.push({
        time: fmtTime(m.returnGarageAt),
        title: 'RETOUR DÉPÔT',
        place: m.origin || 'Dépôt',
      });
    }
    return items;
  }, [assignment, m]);

  return (
    <div className="drv-timeline space-y-4 pt-2">
      {steps.map((s, i) => (
        <div key={`${s.title}-${i}`} className="relative pl-4">
          <span
            className={`drv-dot ${i === 0 ? 'blue' : ''}`}
            style={{ top: 4 }}
          />
          <div className="text-sm font-bold">
            {s.time}{' '}
            <span className="font-semibold text-[var(--drv-muted)]">
              — {s.title}
            </span>
          </div>
          <div className="text-xs text-[var(--drv-muted)]">
            Départ / Arrivée : {s.place}
          </div>
          {s.tag && <span className="drv-chip mt-1">{s.tag}</span>}
        </div>
      ))}
      {assignment.vehicle && (
        <p className="pl-4 text-xs text-[var(--drv-muted)]">
          Véhicule {assignment.vehicle.fleetNumber} · {assignment.vehicle.plate}
          {m.passengers ? ` · ${m.passengers} places` : ''}
        </p>
      )}
    </div>
  );
}
