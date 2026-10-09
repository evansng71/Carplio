'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function OrdersPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      number: string;
      title: string;
      status: string;
      customer: { name: string };
      missions: Array<{ id: string; number: string }>;
    }>
  >([]);
  useEffect(() => {
    api('/orders').then(setRows);
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Commandes</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">N°</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Missions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-semibold">{o.number}</td>
                <td className="px-4 py-3">{o.customer.name}</td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3">
                  {o.missions.map((m) => (
                    <Link
                      key={m.id}
                      className="mr-2 text-action"
                      href={`/app/missions/${m.id}`}
                    >
                      {m.number}
                    </Link>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
