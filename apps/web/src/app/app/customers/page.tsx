'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

type Customer = {
  id: string;
  name: string;
  type: string;
  email?: string;
  contacts: Array<{ id: string; firstName: string; lastName: string }>;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const load = () => api<Customer[]>('/customers').then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    await api('/customers', {
      method: 'POST',
      body: JSON.stringify({ name, email, type: 'enterprise' }),
    });
    setName('');
    setEmail('');
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-sm text-[var(--muted)]">Répertoire CRM — données persistantes.</p>
      </div>
      <form onSubmit={create} className="card grid gap-3 p-4 md:grid-cols-3">
        <div>
          <label className="label">Raison sociale</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Créer</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <Link className="font-semibold text-action" href={`/app/customers/${c.id}`}>
                    {c.name}
                  </Link>
                  <div className="text-xs text-[var(--muted)]">{c.email}</div>
                </td>
                <td className="px-4 py-3">{c.type}</td>
                <td className="px-4 py-3">{c.contacts?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
