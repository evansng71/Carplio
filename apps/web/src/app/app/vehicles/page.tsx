'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function VehiclesPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      fleetNumber: string;
      plate: string;
      brand?: string;
      model?: string;
      seats: number;
      status: string;
      depot?: { name: string };
    }>
  >([]);
  const [form, setForm] = useState({
    fleetNumber: '',
    plate: '',
    brand: '',
    model: '',
    seats: 53,
  });

  const load = () => api('/vehicles').then(setRows);
  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    await api('/vehicles', { method: 'POST', body: JSON.stringify(form) });
    setForm({ fleetNumber: '', plate: '', brand: '', model: '', seats: 53 });
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Véhicules</h1>
      <form onSubmit={create} className="card grid gap-3 p-4 md:grid-cols-5">
        {(['fleetNumber', 'plate', 'brand', 'model'] as const).map((k) => (
          <div key={k}>
            <label className="label">{k}</label>
            <input
              className="input"
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              required={k === 'fleetNumber' || k === 'plate'}
            />
          </div>
        ))}
        <div className="flex items-end">
          <button className="btn-primary w-full">Ajouter</button>
        </div>
      </form>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">Parc</th>
              <th className="px-4 py-3 text-left">Immat.</th>
              <th className="px-4 py-3 text-left">Modèle</th>
              <th className="px-4 py-3 text-left">Places</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-semibold">{v.fleetNumber}</td>
                <td className="px-4 py-3">{v.plate}</td>
                <td className="px-4 py-3">
                  {v.brand} {v.model}
                </td>
                <td className="px-4 py-3">{v.seats}</td>
                <td className="px-4 py-3">{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
