'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AccessTab } from '@/components/AccessTab';

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'info' | 'access'>('info');
  const [d, setD] = useState<{
    id: string;
    licenseNumber?: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      matricule: string;
      email?: string;
    };
    rests: Array<{ kind: string; startsAt: string; endsAt: string }>;
  } | null>(null);

  useEffect(() => {
    api(`/drivers/${id}`).then(setD);
  }, [id]);

  if (!d) return <p>Chargement…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {d.employee.firstName} {d.employee.lastName}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {d.employee.matricule} · {d.employee.email}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className={tab === 'info' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('info')}
        >
          Fiche
        </button>
        <button
          className={tab === 'access' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('access')}
        >
          Accès logiciel & portail
        </button>
      </div>
      {tab === 'info' ? (
        <div className="card space-y-2 p-4 text-sm">
          <div>Permis : {d.licenseNumber || '—'}</div>
          <div className="font-semibold">Repos programmés</div>
          <ul>
            {d.rests.map((r, i) => (
              <li key={i}>
                {r.kind} — {new Date(r.startsAt).toLocaleDateString('fr-FR')} →{' '}
                {new Date(r.endsAt).toLocaleDateString('fr-FR')}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <AccessTab employeeId={d.employee.id} />
      )}
    </div>
  );
}
