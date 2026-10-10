'use client';

import Link from 'next/link';
import type { Assignment } from '../lib';
import { fmtTime } from '../lib';

export function ServiceCard({
  assignment,
  index = 0,
  total = 1,
  showDetailLink = true,
  onStart,
  starting,
}: {
  assignment: Assignment;
  index?: number;
  total?: number;
  showDetailLink?: boolean;
  onStart?: () => void;
  starting?: boolean;
}) {
  const m = assignment.mission;
  const origin = m.origin || m.originAddress || 'Dépôt';
  const dest = m.destination || m.destinationAddress || origin;

  return (
    <article className="drv-card relative overflow-hidden p-4">
      <BusWatermark />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              Service {m.number || m.title}
            </h2>
            {total > 1 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {index + 1}/{total}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--drv-muted)]">
            {m.title}
            {m.order?.customer?.name ? ` · ${m.order.customer.name}` : ''}
          </p>
        </div>
      </div>

      <div className="relative mt-5 space-y-4 pl-1">
        <div className="flex gap-3">
          <div className="flex w-6 flex-col items-center pt-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
              <ClockMini />
            </span>
            <span className="mt-1 w-0.5 flex-1 bg-[var(--drv-red)]" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">
              {fmtTime(assignment.startsAt)}
            </div>
            <div className="text-xs font-semibold uppercase text-[var(--drv-muted)]">
              {origin}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex w-6 flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--drv-red)]" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">
              {fmtTime(assignment.endsAt)}
            </div>
            <div className="text-xs font-semibold uppercase text-[var(--drv-muted)]">
              {dest}
            </div>
          </div>
        </div>
      </div>

      {assignment.vehicle && (
        <p className="relative mt-3 text-xs text-[var(--drv-muted)]">
          Véhicule {assignment.vehicle.fleetNumber || '—'} ·{' '}
          {assignment.vehicle.plate || '—'}
        </p>
      )}

      <div className="relative mt-4 space-y-2">
        {onStart && (
          <button
            type="button"
            className="drv-btn-black"
            disabled={starting}
            onClick={onStart}
          >
            Prise de service
          </button>
        )}
        {showDetailLink && (
          <Link
            href={`/conducteur/jour/${assignment.startsAt.slice(0, 10)}?a=${assignment.id}`}
            className="block text-center text-sm font-semibold text-[var(--drv-red)]"
          >
            Voir le détail
          </Link>
        )}
      </div>
    </article>
  );
}

function ClockMini() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BusWatermark() {
  return (
    <svg
      className="pointer-events-none absolute -right-2 bottom-10 h-28 w-40 text-gray-200 opacity-60"
      viewBox="0 0 120 80"
      fill="currentColor"
    >
      <rect x="10" y="22" width="95" height="36" rx="8" />
      <rect x="18" y="28" width="22" height="14" rx="2" fill="#fff" opacity=".7" />
      <rect x="46" y="28" width="22" height="14" rx="2" fill="#fff" opacity=".7" />
      <rect x="74" y="28" width="22" height="14" rx="2" fill="#fff" opacity=".7" />
      <circle cx="30" cy="60" r="8" />
      <circle cx="88" cy="60" r="8" />
    </svg>
  );
}
