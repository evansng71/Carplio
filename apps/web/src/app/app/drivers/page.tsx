'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function DriversPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      employee: {
        firstName: string;
        lastName: string;
        matricule: string;
        accountLink?: { user: { status: string } };
      };
      depot?: { name: string };
    }>
  >([]);
  useEffect(() => {
    api('/drivers').then(setRows);
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Conducteurs</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Matricule</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Dépôt</th>
              <th className="px-4 py-3 text-left">Accès</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{d.employee.matricule}</td>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-action" href={`/app/drivers/${d.id}`}>
                    {d.employee.firstName} {d.employee.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{d.depot?.name || '—'}</td>
                <td className="px-4 py-3">
                  {d.employee.accountLink?.user.status || 'non créé'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
