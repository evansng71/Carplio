'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function EmployeesPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      matricule: string;
      firstName: string;
      lastName: string;
      jobTitle?: string;
      accountLink?: { user: { status: string } };
    }>
  >([]);
  useEffect(() => {
    api('/employees').then(setRows);
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Salariés / RH</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Matricule</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Poste</th>
              <th className="px-4 py-3 text-left">Accès</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{e.matricule}</td>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-action" href={`/app/employees/${e.id}`}>
                    {e.firstName} {e.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{e.jobTitle || '—'}</td>
                <td className="px-4 py-3">
                  {e.accountLink?.user.status || 'non créé'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
