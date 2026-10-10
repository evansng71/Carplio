'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Profile = {
  customer: {
    id: string;
    name: string;
    tradeName?: string | null;
    reference?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    invoiceEmail?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    siret?: string | null;
    vatNumber?: string | null;
    paymentTermsDays?: number;
    paymentMethod?: string | null;
  };
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    isPrimary: boolean;
  }>;
  bankAccounts: Array<{
    id: string;
    label: string;
    bankName?: string | null;
    iban?: string | null;
  }>;
  destinations: Array<{
    id: string;
    label: string;
    addressLine1?: string | null;
    postalCode?: string | null;
    city?: string | null;
  }>;
};

export default function ClientProfilePage() {
  const [data, setData] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    phone: '',
    mobile: '',
    email: '',
    invoiceEmail: '',
    addressLine1: '',
    postalCode: '',
    city: '',
  });
  const [dest, setDest] = useState({
    label: '',
    addressLine1: '',
    postalCode: '',
    city: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const p = await api<Profile>('/client-portal/profile');
    setData(p);
    setForm({
      phone: p.customer.phone || '',
      mobile: p.customer.mobile || '',
      email: p.customer.email || '',
      invoiceEmail: p.customer.invoiceEmail || '',
      addressLine1: p.customer.addressLine1 || '',
      postalCode: p.customer.postalCode || '',
      city: p.customer.city || '',
    });
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-sm text-rose-600">{err}</p>;
  if (!data) return <p className="text-sm text-[var(--cli-muted)]">Chargement…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="cli-h1">Mon organisation</h1>
        <p className="cli-sub">
          {data.customer.name}
          {data.customer.reference ? ` · ${data.customer.reference}` : ''}
        </p>
      </div>

      <form
        className="cli-card space-y-3 p-4"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          setMsg('');
          try {
            await api('/client-portal/profile', {
              method: 'PATCH',
              body: JSON.stringify(form),
            });
            setMsg('Coordonnées mises à jour');
            await load();
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
      >
        <div className="font-bold">Coordonnées</div>
        {(
          [
            ['email', 'E-mail'],
            ['invoiceEmail', 'E-mail facturation'],
            ['phone', 'Téléphone'],
            ['mobile', 'Mobile'],
            ['addressLine1', 'Adresse'],
            ['postalCode', 'Code postal'],
            ['city', 'Ville'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-xs font-semibold text-[var(--cli-muted)]">
            {label}
            <input
              className="cli-input mt-1"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <div className="text-xs text-[var(--cli-muted)]">
          SIRET {data.customer.siret || '—'} · TVA {data.customer.vatNumber || '—'} ·
          Paiement {data.customer.paymentTermsDays} j /{' '}
          {data.customer.paymentMethod || 'virement'}
        </div>
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <button type="submit" className="cli-btn cli-btn-primary">
          Enregistrer
        </button>
      </form>

      <section className="cli-card p-4">
        <div className="font-bold">Contacts</div>
        <ul className="mt-2 space-y-2 text-sm">
          {data.contacts.map((c) => (
            <li key={c.id} className="rounded-xl bg-[var(--cli-bg)] px-3 py-2">
              <div className="font-semibold">
                {c.firstName} {c.lastName}
                {c.isPrimary ? ' · Principal' : ''}
              </div>
              <div className="text-xs text-[var(--cli-muted)]">
                {c.role || '—'} · {c.email || '—'} · {c.phone || '—'}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="cli-card p-4">
        <div className="font-bold">Comptes bancaires (masqués)</div>
        <ul className="mt-2 space-y-2 text-sm">
          {data.bankAccounts.map((b) => (
            <li key={b.id}>
              {b.label}
              {b.bankName ? ` · ${b.bankName}` : ''} · {b.iban || '—'}
            </li>
          ))}
        </ul>
      </section>

      <section className="cli-card space-y-3 p-4">
        <div className="font-bold">Destinations favorites</div>
        <ul className="space-y-2 text-sm">
          {data.destinations.map((d) => (
            <li key={d.id} className="rounded-xl bg-[var(--cli-bg)] px-3 py-2">
              <div className="font-semibold">{d.label}</div>
              <div className="text-xs text-[var(--cli-muted)]">
                {[d.addressLine1, d.postalCode, d.city].filter(Boolean).join(', ') ||
                  '—'}
              </div>
            </li>
          ))}
        </ul>
        <form
          className="space-y-2 border-t border-[var(--cli-line)] pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await api('/client-portal/destinations', {
              method: 'POST',
              body: JSON.stringify(dest),
            });
            setDest({ label: '', addressLine1: '', postalCode: '', city: '' });
            await load();
          }}
        >
          <div className="text-xs font-semibold text-[var(--cli-muted)]">
            Ajouter un lieu
          </div>
          <input
            className="cli-input"
            placeholder="Libellé"
            required
            value={dest.label}
            onChange={(e) => setDest({ ...dest, label: e.target.value })}
          />
          <input
            className="cli-input"
            placeholder="Adresse"
            value={dest.addressLine1}
            onChange={(e) => setDest({ ...dest, addressLine1: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="cli-input"
              placeholder="CP"
              value={dest.postalCode}
              onChange={(e) => setDest({ ...dest, postalCode: e.target.value })}
            />
            <input
              className="cli-input"
              placeholder="Ville"
              value={dest.city}
              onChange={(e) => setDest({ ...dest, city: e.target.value })}
            />
          </div>
          <button type="submit" className="cli-btn cli-btn-secondary">
            Ajouter
          </button>
        </form>
      </section>
    </div>
  );
}
