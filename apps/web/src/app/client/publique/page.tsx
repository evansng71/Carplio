'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function PublicQuotePage() {
  const [brand, setBrand] = useState<{
    name: string;
    logoUrl?: string | null;
  }>({ name: 'Espace client', logoUrl: null });
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
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{
      companyName?: string;
      tradeName?: string | null;
      logoUrl?: string | null;
    }>('/org/branding')
      .then((b) =>
        setBrand({
          name: b.tradeName || b.companyName || 'Espace client',
          logoUrl: b.logoUrl,
        }),
      )
      .catch(() => undefined);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    const res = await fetch(`${API}/public/quote-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.message || 'Erreur');
      return;
    }
    setOk('Demande envoyée — un commercial vous recontactera.');
  }

  return (
    <div className="cli-login-wrap">
      <section className="cli-login-panel">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="mb-8 h-16 w-auto max-w-[240px] object-contain"
          />
        ) : (
          <div className="mb-8 text-2xl font-bold">{brand.name}</div>
        )}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200/80">
          Demande publique
        </p>
        <h1
          className="mt-3 text-4xl font-bold tracking-tight"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Obtenez un devis
          <br />
          en quelques minutes
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
          Sans créer de compte. Notre équipe commerciale revient vers vous sous
          48h ouvrées.
        </p>
        <Link
          href="/client"
          className="cli-btn mt-8 border border-white/20 bg-white/10 text-white hover:bg-white/15"
        >
          J’ai déjà un compte →
        </Link>
      </section>
      <section className="cli-login-form-wrap">
        <form
          onSubmit={submit}
          className="cli-login-form cli-card space-y-3 p-7"
        >
          <h2 className="text-xl font-bold">Votre besoin</h2>
          <input
            className="cli-input"
            placeholder="Nom / organisme"
            required
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <input
            className="cli-input"
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="cli-input"
            placeholder="Téléphone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
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
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
            />
            <input
              className="cli-input"
              placeholder="Destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="cli-input"
              type="datetime-local"
              value={form.departureAt}
              onChange={(e) =>
                setForm({ ...form, departureAt: e.target.value })
              }
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
            placeholder="Type de véhicule souhaité"
            value={form.vehicleHint}
            onChange={(e) => setForm({ ...form, vehicleHint: e.target.value })}
          />
          <textarea
            className="cli-textarea min-h-[90px]"
            placeholder="Précisions (horaires, PMR, bagages…)"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          {err && <p className="text-sm text-rose-600">{err}</p>}
          {ok && <p className="text-sm text-emerald-700">{ok}</p>}
          <button className="cli-btn cli-btn-primary w-full" type="submit">
            Envoyer la demande
          </button>
        </form>
      </section>
    </div>
  );
}
