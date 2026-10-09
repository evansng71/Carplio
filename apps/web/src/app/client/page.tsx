'use client';

import { FormEvent, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function PublicClientPortal() {
  const [form, setForm] = useState({
    contactName: '',
    email: '',
    phone: '',
    origin: '',
    destination: '',
    departureAt: '',
    passengers: 40,
    message: '',
  });
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

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
    setForm({
      contactName: '',
      email: '',
      phone: '',
      origin: '',
      destination: '',
      departureAt: '',
      passengers: 40,
      message: '',
    });
  }

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, #0B1F33 0%, #14324F 40%, #1B6CA8 100%)',
        }}
      />
      <div className="relative mx-auto max-w-xl px-6 py-16 text-cream">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
          AUTOCAR OS
        </p>
        <h1 className="mt-2 text-3xl font-bold">Demande de devis</h1>
        <p className="mt-2 text-sm text-white/80">
          Portail client Autocars Horizon — transport occasionnel & groupes.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-3 rounded-2xl bg-white p-6 text-night shadow-panel">
          <input className="input" placeholder="Nom" required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <input className="input" type="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Origine" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            <input className="input" placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          </div>
          <input className="input" type="datetime-local" value={form.departureAt} onChange={(e) => setForm({ ...form, departureAt: e.target.value })} />
          <input className="input" type="number" min={1} value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) })} />
          <textarea className="input" placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          {err && <p className="text-sm text-danger">{err}</p>}
          {ok && <p className="text-sm text-ok">{ok}</p>}
          <button className="btn-primary w-full py-3">Envoyer la demande</button>
        </form>
      </div>
    </div>
  );
}
