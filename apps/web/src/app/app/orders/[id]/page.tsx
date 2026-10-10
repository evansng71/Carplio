'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { IconClipboard, IconTile } from '@/components/Icons';
import { ORDER_STATUS } from '@/lib/commercial';
import { formatMoney } from '@/lib/billing';

type OrderDetail = {
  id: string;
  number: string;
  title: string;
  status: string;
  origin?: string | null;
  destination?: string | null;
  departureAt?: string | null;
  returnAt?: string | null;
  passengers: number;
  amountHt: number;
  vatRate: number;
  amountTtc: number;
  depositPaidHt: number;
  customerPoNumber?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  clientNotes?: string | null;
  internalNotes?: string | null;
  customer: { id: string; name: string };
  quote?: {
    id: string;
    number: string;
    serviceType?: string;
    depositAmountHt?: number;
  } | null;
  salesperson?: { displayName: string } | null;
  missions: Array<{
    id: string;
    number: string;
    status: string;
    startsAt: string;
    endsAt: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    kind: string;
    amountTtc: number;
    balance: number;
  }>;
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    status: '',
    customerPoNumber: '',
    depositPaidHt: 0,
    clientNotes: '',
    internalNotes: '',
    cancelReason: '',
  });

  const load = useCallback(async () => {
    try {
      const o = await api<OrderDetail>(`/orders/${id}`);
      setOrder(o);
      setForm({
        status: o.status,
        customerPoNumber: o.customerPoNumber || '',
        depositPaidHt: o.depositPaidHt || 0,
        clientNotes: o.clientNotes || '',
        internalNotes: o.internalNotes || '',
        cancelReason: o.cancelReason || '',
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const updated = await api<OrderDetail>(`/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setOrder(updated);
      setMsg('Commande enregistrée');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !order) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }
  if (!order) {
    return <div className="text-sm text-[var(--muted)]">Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="orange">
            <IconClipboard />
          </IconTile>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{order.number}</h1>
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-900">
                {ORDER_STATUS[order.status] || order.status}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">{order.title}</p>
            <p className="mt-1 text-sm">
              Client :{' '}
              <Link
                className="text-action"
                href={`/app/customers/${order.customer.id}`}
              >
                {order.customer.name}
              </Link>
              {order.quote && (
                <>
                  {' '}
                  · Devis{' '}
                  <Link
                    className="text-action"
                    href={`/app/quotes/${order.quote.id}`}
                  >
                    {order.quote.number}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <Link href="/app/orders" className="btn-secondary">
          Retour
        </Link>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Trajet</p>
          <p className="font-semibold">
            {[order.origin, order.destination].filter(Boolean).join(' → ') ||
              '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Départ / retour</p>
          <p className="text-sm font-medium">{fmt(order.departureAt)}</p>
          <p className="text-xs text-[var(--muted)]">{fmt(order.returnAt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Passagers</p>
          <p className="text-xl font-bold">{order.passengers}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Montant TTC</p>
          <p className="text-xl font-bold">{formatMoney(order.amountTtc)}</p>
          <p className="text-xs text-[var(--muted)]">
            HT {formatMoney(order.amountHt)} · TVA {order.vatRate}%
          </p>
        </div>
      </div>

      <form onSubmit={save} className="card grid gap-3 p-4 md:grid-cols-2">
        <div>
          <label className="label">Statut</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {Object.entries(ORDER_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">N° bon de commande client</label>
          <input
            className="input"
            value={form.customerPoNumber}
            onChange={(e) =>
              setForm({ ...form, customerPoNumber: e.target.value })
            }
          />
        </div>
        <div>
          <label className="label">Acompte encaissé HT</label>
          <input
            className="input"
            type="number"
            min={0}
            step={0.01}
            value={form.depositPaidHt}
            onChange={(e) =>
              setForm({
                ...form,
                depositPaidHt: Number(e.target.value) || 0,
              })
            }
          />
          {order.quote?.depositAmountHt ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Prévu au devis : {formatMoney(order.quote.depositAmountHt)}
            </p>
          ) : null}
        </div>
        <div>
          <label className="label">Motif d’annulation</label>
          <input
            className="input"
            value={form.cancelReason}
            onChange={(e) =>
              setForm({ ...form, cancelReason: e.target.value })
            }
            disabled={form.status !== 'cancelled'}
          />
        </div>
        <div>
          <label className="label">Notes client</label>
          <textarea
            className="input min-h-[80px]"
            value={form.clientNotes}
            onChange={(e) => setForm({ ...form, clientNotes: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Notes internes</label>
          <textarea
            className="input min-h-[80px]"
            value={form.internalNotes}
            onChange={(e) =>
              setForm({ ...form, internalNotes: e.target.value })
            }
          />
        </div>
        <div className="md:col-span-2">
          <button className="btn-primary" disabled={busy}>
            Enregistrer
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Missions
          </div>
          <table className="w-full text-sm">
            <tbody>
              {order.missions.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-action"
                      href={`/app/missions/${m.id}`}
                    >
                      {m.number}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">
                      {fmt(m.startsAt)} → {fmt(m.endsAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {m.status}
                  </td>
                </tr>
              ))}
              {order.missions.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-[var(--muted)]">
                    Aucune mission
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Factures liées
          </div>
          <table className="w-full text-sm">
            <tbody>
              {order.invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-action"
                      href={`/app/billing/${inv.id}`}
                    >
                      {inv.number}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">
                      {inv.kind} · {inv.status}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(inv.amountTtc)}
                    {inv.balance > 0 && (
                      <div className="text-xs text-amber-700">
                        Reste {formatMoney(inv.balance)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {order.invoices.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-[var(--muted)]">
                    Aucune facture
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
