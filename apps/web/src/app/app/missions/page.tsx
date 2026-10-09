'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function MissionsPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      number: string;
      title: string;
      status: string;
      startsAt: string;
      origin?: string;
      destination?: string;
      assignments: unknown[];
      documents: unknown[];
    }>
  >([]);
  useEffect(() => {
    api('/missions').then(setRows);
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Missions</h1>
      <div className="space-y-2">
        {rows.map((m) => (
          <Link
            key={m.id}
            href={`/app/missions/${m.id}`}
            className="card block p-4 hover:border-action/40"
          >
            <div className="font-semibold">
              {m.number} — {m.title}
            </div>
            <div className="text-sm text-[var(--muted)]">
              {new Date(m.startsAt).toLocaleString('fr-FR')} · {m.origin} →{' '}
              {m.destination} · {m.status} · {m.assignments.length} affect. ·{' '}
              {m.documents.length} doc.
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
