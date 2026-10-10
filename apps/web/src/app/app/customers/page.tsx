'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { IconPlus, IconTile, IconUsers } from '@/components/Icons';
import { CUSTOMER_TYPES } from '@/lib/customer';
import {
  CommercialFilters,
  compareBy,
} from '@/components/CommercialFilters';

type CustomerRow = {
  id: string;
  reference?: string | null;
  name: string;
  tradeName?: string | null;
  type: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  alertNote?: string | null;
  contacts: Array<{ firstName: string; lastName: string }>;
  _count: { quotes: number; invoices: number; contacts: number };
};

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('name_asc');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'enterprise',
    city: '',
  });

  const load = useCallback(async () => {
    const data = await api<CustomerRow[]>(
      `/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
    );
    setRows(data);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = useMemo(() => {
    let list = type ? rows.filter((r) => r.type === type) : rows;
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    list = [...list].sort((a, b) => {
      if (key === 'name') return compareBy(a.name, b.name, dir);
      if (key === 'city') return compareBy(a.city, b.city, dir);
      if (key === 'quotes')
        return compareBy(a._count.quotes, b._count.quotes, dir);
      if (key === 'ref') return compareBy(a.reference, b.reference, dir);
      return 0;
    });
    return list;
  }, [rows, type, sort]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api<{ id: string }>('/customers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: '', email: '', phone: '', type: 'enterprise', city: '' });
      window.location.href = `/app/customers/${created.id}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="teal" className="h-12 w-12">
            <IconUsers size={22} />
          </IconTile>
          <div>
            <p className="page-kicker">Module commercial</p>
            <h1 className="mt-1 text-2xl font-bold">Clients</h1>
            <p className="text-sm text-[var(--muted)]">
              Répertoire clients — fiches complètes, devis et facturation.
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setOpen((v) => !v)}>
          <IconPlus size={16} />
          Nouveau client
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="card grid gap-3 p-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="label">Raison sociale</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {CUSTOMER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Ville</label>
            <input
              className="input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <button className="btn-primary" disabled={busy}>
              Créer et ouvrir la fiche
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <CommercialFilters
        search={q}
        onSearch={setQ}
        searchPlaceholder="Référence, nom, email, ville, SIRET…"
        filters={[
          {
            key: 'type',
            label: 'Type',
            value: type,
            onChange: setType,
            options: [
              { value: '', label: 'Tous' },
              ...CUSTOMER_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              })),
            ],
          },
        ]}
        sort={sort}
        onSort={setSort}
        sortOptions={[
          { value: 'name_asc', label: 'Nom A→Z' },
          { value: 'name_desc', label: 'Nom Z→A' },
          { value: 'city_asc', label: 'Ville' },
          { value: 'quotes_desc', label: 'Nb devis ↓' },
          { value: 'ref_asc', label: 'Référence' },
        ]}
        resultCount={filtered.length}
        resultLabel="client(s)"
      />

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-night/5 text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Réf.</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Activité</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const primary = c.contacts[0];
              const typeLabel =
                CUSTOMER_TYPES.find((t) => t.value === c.type)?.label || c.type;
              return (
                <tr
                  key={c.id}
                  className="border-t border-[var(--border)] hover:bg-action/[0.03]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {c.reference || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-action hover:underline"
                      href={`/app/customers/${c.id}`}
                    >
                      {c.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="badge-teal">{typeLabel}</span>
                      {c.alertNote && (
                        <span className="badge-warn">Alerte</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {primary
                      ? `${primary.firstName} ${primary.lastName}`
                      : '—'}
                    <div className="text-[var(--muted)]">
                      {c.email || c.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {c._count.quotes} devis · {c._count.invoices} factures
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-[var(--muted)]"
                >
                  Aucun client trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
