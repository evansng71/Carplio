'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AccessTab } from '@/components/AccessTab';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'info' | 'access'>('info');
  const [e, setE] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    matricule: string;
    email?: string;
    sensitiveNotes?: string | null;
    _sensitiveHidden?: boolean;
  } | null>(null);

  useEffect(() => {
    api(`/employees/${id}`).then(setE);
  }, [id]);

  if (!e) return <p>Chargement…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {e.firstName} {e.lastName}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {e.matricule} · {e.email}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className={tab === 'info' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('info')}
        >
          Fiche RH
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
          <div>
            Notes sensibles :{' '}
            {e._sensitiveHidden
              ? '(masquées — permission insuffisante)'
              : e.sensitiveNotes || '—'}
          </div>
        </div>
      ) : (
        <AccessTab employeeId={e.id} />
      )}
    </div>
  );
}
