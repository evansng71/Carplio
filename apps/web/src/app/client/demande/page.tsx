'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { badgeClass, dt } from '../lib';

type Req = {
  id: string;
  tripType?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureAt?: string | null;
  passengers: number;
  status: string;
  message?: string | null;
  createdAt: string;
};

export default function ClientRequestPage() {
  const [form, setForm] = useState({
    contactName: '',
    email: '',
    phone: '',
    tripType: 'occasionnel',
    origin: '',
    destination: '',
    departureAt: '',
    returnAt: '',
    passengers: 40,
    vehicleHint: '',
    budgetHint: '',
    message: '',
  });
  const [rows, setRows] = useState<Req[]>([]);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const me = await api<{
      user: { displayName: string; email: string };
      customer: { phone?: string | null };
    }>('/client-portal/me');
    setForm((f) => ({
      ...f,
      contactName: f.contactName || me.user.displayName,
      email: f.email || me.user.email,
      phone: f.phone || me.customer.phone || '',
    }));
    setRows(await api<Req[]>('/client-portal/requests'));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="cli-kicker">Commercial</p>
        <h1 className="cli-h1 mt-1">Demande de devis</h1>
        <p className="cli-sub">
          Décrivez votre besoin — suivi dans vos demandes ci-dessous.
        </p>
      </div>

      <form
        className="cli-card space-y-3 p-4"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          setErr('');
          setOk('');
          try {
            await api('/client-portal/requests', {
              method: 'POST',
              body: JSON.stringify(form),
            });
            setOk('Demande envoyée');
            await load();
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
      >
        <select
          className="cli-select"
          value={form.tripType}
          onChange={(e) => setForm({ ...form, tripType: e.target.value })}
        >
          <option value="occasionnel">Occasionnel</option>
          <option value="scolaire">Scolaire</option>
          <option value="entreprise">Entreprise</option>
          <option value="evenement">Événement</option>
          <option value="autre">Autre</option>
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="cli-input"
            placeholder="Origine"
            required
            value={form.origin}
            onChange={(e) => setForm({ ...form, origin: e.target.value })}
          />
          <input
            className="cli-input"
            placeholder="Destination"
            required
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="cli-input"
            type="datetime-local"
            value={form.departureAt}
            onChange={(e) => setForm({ ...form, departureAt: e.target.value })}
          />
          <input
            className="cli-input"
            type="datetime-local"
            value={form.returnAt}
            onChange={(e) => setForm({ ...form, returnAt: e.target.value })}
          />
        </div>
        <input
          className="cli-input"
          type="number"
          min={1}
          value={form.passengers}
          onChange={(e) =>
            setForm({ ...form, passengers: Number(e.target.value) })
          }
        />
        <input
          className="cli-input"
          placeholder="Véhicule souhaité"
          value={form.vehicleHint}
          onChange={(e) => setForm({ ...form, vehicleHint: e.target.value })}
        />
        <input
          className="cli-input"
          placeholder="Budget indicatif"
          value={form.budgetHint}
          onChange={(e) => setForm({ ...form, budgetHint: e.target.value })}
        />
        <textarea
          className="cli-textarea min-h-[90px]"
          placeholder="Précisions"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
        <button type="submit" className="cli-btn cli-btn-primary w-full">
          Envoyer
        </button>
      </form>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Mes demandes</h2>
          <Link href="/client/messages" className="text-xs font-semibold text-[var(--cli-accent)]">
            Contacter le commercial
          </Link>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="cli-card p-3 text-sm">
            <div className="flex justify-between gap-2">
              <div className="font-semibold">
                {r.origin} → {r.destination}
              </div>
              <span className={badgeClass(r.status === 'new' ? 'warn' : 'info')}>
                {r.status}
              </span>
            </div>
            <div className="text-xs text-[var(--cli-muted)]">
              {r.tripType || '—'} · {r.passengers} pax ·{' '}
              {r.departureAt ? dt(r.departureAt) : 'Date libre'} · créée{' '}
              {dt(r.createdAt, false)}
            </div>
            {r.message && (
              <p className="mt-1 text-[var(--cli-muted)]">{r.message}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
