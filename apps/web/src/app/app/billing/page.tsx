'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Invoice = {
  id: string;
  number: string;
  kind: string;
  status: string;
  amountTtc: number;
  balance: number;
  customer: { id: string; name: string };
  lines: Array<{ label: string; amountHt: number }>;
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<Array<{ id: string; remaining: number; customer: { name: string } }>>([]);
  const [missions, setMissions] = useState<Array<{ id: string; number: string; title: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [payAmount, setPayAmount] = useState(0);
  const [msg, setMsg] = useState('');

  const load = () => {
    api<Invoice[]>('/billing/invoices').then(setInvoices);
    api('/billing/credits').then(setCredits);
    api('/missions').then(setMissions);
  };
  useEffect(() => {
    load();
  }, []);

  async function invoiceMission(id: string, kind = 'standard') {
    await api(`/billing/invoices/from-mission/${id}`, {
      method: 'POST',
      body: JSON.stringify({ kind }),
    });
    setMsg(`Facture ${kind} créée`);
    load();
  }

  async function creditNote(id: string) {
    await api(`/billing/invoices/${id}/credit-note`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Avoir partiel DEMO' }),
    });
    setMsg('Avoir créé');
    load();
  }

  async function paySelected() {
    const open = invoices.filter((i) => selected.includes(i.id) && i.balance > 0);
    if (!open.length) return;
    const customerId = open[0].customer.id;
    const allocations = open.map((i) => ({
      invoiceId: i.id,
      amount: Math.min(i.balance, payAmount / open.length),
    }));
    // Better: allocate sequentially
    let remaining = payAmount;
    const allocs: Array<{ invoiceId: string; amount: number }> = [];
    for (const i of open) {
      if (remaining <= 0) break;
      const amount = Math.min(i.balance, remaining);
      allocs.push({ invoiceId: i.id, amount });
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
    const r = await api<{ overpay: number }>('/billing/payments', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        amount: payAmount,
        method: 'transfer',
        allocations: allocs.length ? allocs : allocations,
      }),
    });
    setMsg(
      r.overpay > 0
        ? `Paiement enregistré — trop-perçu ${r.overpay.toFixed(2)} €`
        : 'Paiement ventilé enregistré',
    );
    setSelected([]);
    load();
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturation & règlements</h1>
        <p className="text-sm text-[var(--muted)]">
          Facture, complémentaire, avoir, paiement multi-factures, trop-perçus.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      <section className="card p-4">
        <h2 className="font-semibold">Facturer une mission</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {missions.slice(0, 8).map((m) => (
            <div key={m.id} className="flex gap-1">
              <button className="btn-primary" onClick={() => invoiceMission(m.id)}>
                {m.number}
              </button>
              <button
                className="btn-ghost border border-[var(--border)]"
                onClick={() => invoiceMission(m.id, 'supplementary')}
                title="Facture complémentaire"
              >
                +
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2 text-left">N°</th>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">TTC</th>
              <th className="px-3 py-2 text-right">Solde</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(i.id)}
                    onChange={() => toggle(i.id)}
                    disabled={i.balance <= 0 || i.kind === 'credit_note'}
                  />
                </td>
                <td className="px-3 py-2 font-semibold">{i.number}</td>
                <td className="px-3 py-2">{i.customer.name}</td>
                <td className="px-3 py-2">{i.kind}</td>
                <td className="px-3 py-2 text-right">{i.amountTtc.toFixed(2)} €</td>
                <td className="px-3 py-2 text-right">{i.balance.toFixed(2)} €</td>
                <td className="px-3 py-2">
                  {i.kind !== 'credit_note' && (
                    <button className="text-action" onClick={() => creditNote(i.id)}>
                      Avoir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Montant paiement (ventilation auto)</label>
          <input
            className="input"
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(Number(e.target.value))}
          />
        </div>
        <button className="btn-primary" onClick={paySelected} disabled={!selected.length}>
          Enregistrer paiement ({selected.length} facture(s))
        </button>
        <p className="w-full text-xs text-[var(--muted)]">
          Si le montant dépasse les soldes, un trop-perçu créditeur est créé.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Trop-perçus / crédits clients</h2>
        <ul className="mt-2 text-sm">
          {credits.map((c) => (
            <li key={c.id}>
              {c.customer.name} — {c.remaining.toFixed(2)} € restant
            </li>
          ))}
          {credits.length === 0 && (
            <li className="text-[var(--muted)]">Aucun crédit ouvert.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
