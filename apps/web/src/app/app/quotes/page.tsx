'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Customer = { id: string; name: string };
type Quote = {
  id: string;
  number: string;
  title: string;
  status: string;
  amountTtc: number;
  availabilityNote?: string;
  availabilityConfidence?: string;
  customer: Customer;
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    customerId: '',
    title: '',
    origin: '',
    destination: '',
    departureAt: '',
    passengers: 40,
    amountHt: 450,
    caseType: 'simple',
  });

  const load = () => {
    api<Quote[]>('/quotes').then(setQuotes);
    api<Customer[]>('/customers').then((rows) => {
      setCustomers(rows);
      if (!form.customerId && rows[0]) {
        setForm((f) => ({ ...f, customerId: rows[0].id }));
      }
    });
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    await api('/quotes', { method: 'POST', body: JSON.stringify(form) });
    load();
  }

  async function accept(id: string) {
    await api(`/quotes/${id}/accept`, { method: 'POST', body: '{}' });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Devis</h1>
        <p className="text-sm text-[var(--muted)]">
          Estimation de disponibilité théorique avant envoi — pas de réservation ferme.
        </p>
      </div>
      <form onSubmit={create} className="card grid gap-3 p-4 md:grid-cols-3">
        <div>
          <label className="label">Client</label>
          <select
            className="input"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Titre</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Type dossier</label>
          <select
            className="input"
            value={form.caseType}
            onChange={(e) => setForm({ ...form, caseType: e.target.value })}
          >
            <option value="simple">Simple</option>
            <option value="transfer">Transfert A/R</option>
            <option value="repetitive">Répétitif</option>
            <option value="complex">Complexe</option>
          </select>
        </div>
        <div>
          <label className="label">Origine</label>
          <input
            className="input"
            value={form.origin}
            onChange={(e) => setForm({ ...form, origin: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Destination</label>
          <input
            className="input"
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Départ</label>
          <input
            className="input"
            type="datetime-local"
            value={form.departureAt}
            onChange={(e) => setForm({ ...form, departureAt: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Voyageurs</label>
          <input
            className="input"
            type="number"
            value={form.passengers}
            onChange={(e) =>
              setForm({ ...form, passengers: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="label">Montant HT</label>
          <input
            className="input"
            type="number"
            value={form.amountHt}
            onChange={(e) =>
              setForm({ ...form, amountHt: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Créer devis</button>
        </div>
      </form>
      <div className="space-y-3">
        {quotes.map((q) => (
          <div key={q.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
            <div>
              <div className="font-semibold">
                {q.number} — {q.title}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {q.customer.name} · {q.amountTtc.toFixed(2)} € TTC · {q.status}
              </div>
              {q.availabilityNote && (
                <div className="mt-1 text-xs text-action">
                  Dispo ({q.availabilityConfidence}): {q.availabilityNote}
                </div>
              )}
            </div>
            {q.status !== 'accepted' && (
              <button className="btn-primary" onClick={() => accept(q.id)}>
                Accepter → commande
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
