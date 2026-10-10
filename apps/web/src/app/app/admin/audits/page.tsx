'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Audit = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detailJson: string | null;
  createdAt: string;
  actor?: { email: string; displayName: string } | null;
};

export default function AdminAuditsPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Audit[]>('/audits?limit=100')
      .then(setAudits)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link
          href="/app/admin"
          className="text-xs font-semibold text-action hover:underline"
        >
          ← Administration
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Journal d’audit</h1>
        <p className="text-sm text-[var(--muted)]">
          Actions sensibles sur les comptes, groupes et permissions.
        </p>
      </div>

      {err && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {err}
        </p>
      )}

      <div className="card overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-night/5 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Acteur</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Cible</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((a) => (
              <tr key={a.id} className="border-t border-[var(--border)]">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--muted)]">
                  {new Date(a.createdAt).toLocaleString('fr-FR')}
                </td>
                <td className="px-3 py-2">
                  {a.actor?.displayName || '—'}
                  <div className="text-xs text-[var(--muted)]">
                    {a.actor?.email}
                  </div>
                </td>
                <td className="px-3 py-2 font-medium">{a.action}</td>
                <td className="px-3 py-2 text-xs text-[var(--muted)]">
                  {a.targetType || '—'}
                  {a.targetId ? ` · ${a.targetId.slice(0, 8)}…` : ''}
                </td>
              </tr>
            ))}
            {audits.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-[var(--muted)]"
                >
                  Aucun événement
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
