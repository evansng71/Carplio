'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, openPrintHtml } from '@/lib/api';
import { IconInvoice, IconTile } from '@/components/Icons';
import {
  formatDate,
  formatMoney,
  INVOICE_KIND,
  INVOICE_STATUS,
  isOverdue,
  PAYMENT_METHODS,
  statusTone,
} from '@/lib/billing';
import { LINE_KINDS, LINE_UNITS, lineAmount } from '@/lib/commercial';

type Line = {
  kind: string;
  label: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
};

type InvoiceDetail = {
  id: string;
  number: string;
  kind: string;
  status: string;
  amountHt: number;
  vatRate: number;
  amountTtc: number;
  balance: number;
  notes?: string | null;
  dueAt?: string | null;
  issuedAt: string;
  paidAt?: string | null;
  customerPoNumber?: string | null;
  paymentTermsDays?: number | null;
  paymentMethod?: string | null;
  serviceFrom?: string | null;
  serviceTo?: string | null;
  legalMentions?: string | null;
  reference?: string | null;
  reminderCount?: number;
  lastReminderAt?: string | null;
  customer: {
    id: string;
    name: string;
    requirePurchaseOrder?: boolean;
  };
  quote?: { id: string; number: string; title: string } | null;
  order?: { id: string; number: string; title: string } | null;
  lines: Array<Line & { id?: string; amountHt: number }>;
  allocations?: Array<{
    amount: number;
    payment: { id: string; paidAt: string; method: string; notes?: string | null };
  }>;
};

function toDate(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [form, setForm] = useState({
    vatRate: 10,
    notes: '',
    dueAt: '',
    kind: 'standard',
    customerPoNumber: '',
    paymentTermsDays: 30,
    paymentMethod: 'transfer',
    serviceFrom: '',
    serviceTo: '',
    legalMentions: '',
    reference: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await api<InvoiceDetail>(`/billing/invoices/${id}`);
      setInv(data);
      setLines(
        data.lines.map((l) => ({
          kind: l.kind || 'transport',
          label: l.label,
          unit: l.unit || 'forfait',
          quantity: l.quantity,
          unitPriceHt: l.unitPriceHt,
        })),
      );
      setForm({
        vatRate: data.vatRate,
        notes: data.notes || '',
        dueAt: toDate(data.dueAt),
        kind: data.kind,
        customerPoNumber: data.customerPoNumber || '',
        paymentTermsDays: data.paymentTermsDays ?? 30,
        paymentMethod: data.paymentMethod || 'transfer',
        serviceFrom: toDate(data.serviceFrom),
        serviceTo: toDate(data.serviceTo),
        legalMentions: data.legalMentions || '',
        reference: data.reference || '',
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const draft = inv?.status === 'draft';
  const linesHt = lines.reduce((s, l) => s + lineAmount(l), 0);
  const linesTtc =
    Math.round(linesHt * (1 + form.vatRate / 100) * 100) / 100;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const body: Record<string, unknown> = {
        notes: form.notes || null,
        dueAt: form.dueAt || null,
        kind: form.kind,
        customerPoNumber: form.customerPoNumber || null,
        paymentTermsDays: form.paymentTermsDays,
        paymentMethod: form.paymentMethod,
        serviceFrom: form.serviceFrom || null,
        serviceTo: form.serviceTo || null,
        legalMentions: form.legalMentions || null,
        reference: form.reference || null,
        vatRate: form.vatRate,
      };
      if (draft) body.lines = lines;
      const updated = await api<InvoiceDetail>(`/billing/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setInv(updated);
      setMsg('Facture enregistrée');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doAction(path: string, success: string) {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const updated = await api<InvoiceDetail>(`/billing/invoices/${id}/${path}`, {
        method: 'POST',
        body: '{}',
      });
      setInv(updated);
      setMsg(success);
      if (path === 'cancel') await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !inv) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }
  if (!inv) {
    return <div className="text-sm text-[var(--muted)]">Chargement…</div>;
  }

  const overdue = isOverdue(inv);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="teal">
            <IconInvoice />
          </IconTile>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{inv.number}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone(inv.status)}`}
              >
                {INVOICE_STATUS[inv.status] || inv.status}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">
                {INVOICE_KIND[inv.kind] || inv.kind}
              </span>
              {overdue && (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                  En retard
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--muted)]">
              Client{' '}
              <Link
                className="text-action"
                href={`/app/customers/${inv.customer.id}`}
              >
                {inv.customer.name}
              </Link>
              {inv.quote && (
                <>
                  {' '}
                  · Devis{' '}
                  <Link className="text-action" href={`/app/quotes/${inv.quote.id}`}>
                    {inv.quote.number}
                  </Link>
                </>
              )}
              {inv.order && (
                <>
                  {' '}
                  · Commande{' '}
                  <Link className="text-action" href={`/app/orders/${inv.order.id}`}>
                    {inv.order.number}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/billing" className="btn-secondary">
            Retour
          </Link>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => openPrintHtml(`/documents/print/invoice/${id}`)}
          >
            Imprimer
          </button>
          {draft && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => doAction('issue', 'Facture émise')}
            >
              Émettre
            </button>
          )}
          {!draft && inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => doAction('remind', 'Relance enregistrée')}
            >
              Relancer
              {inv.reminderCount ? ` (${inv.reminderCount})` : ''}
            </button>
          )}
          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => doAction('cancel', 'Facture annulée')}
            >
              Annuler
            </button>
          )}
          {inv.kind !== 'credit_note' && inv.status !== 'draft' && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const credit = await api<{ id: string }>(
                    `/billing/invoices/${id}/credit-note`,
                    { method: 'POST', body: '{}' },
                  );
                  router.push(`/app/billing/${credit.id}`);
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Créer un avoir
            </button>
          )}
        </div>
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
          <p className="text-xs text-[var(--muted)]">Montant HT</p>
          <p className="text-xl font-bold">{formatMoney(inv.amountHt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">TTC</p>
          <p className="text-xl font-bold">{formatMoney(inv.amountTtc)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Solde dû</p>
          <p className="text-xl font-bold">{formatMoney(inv.balance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Échéance</p>
          <p className="text-xl font-bold">{formatDate(inv.dueAt)}</p>
          {inv.lastReminderAt && (
            <p className="text-xs text-[var(--muted)]">
              Dernière relance {formatDate(inv.lastReminderAt)}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        <section className="card grid gap-3 p-4 md:grid-cols-3">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              disabled={!draft}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {Object.entries(INVOICE_KIND).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">N° BC client</label>
            <input
              className="input"
              value={form.customerPoNumber}
              onChange={(e) =>
                setForm({ ...form, customerPoNumber: e.target.value })
              }
              required={!!inv.customer.requirePurchaseOrder}
            />
          </div>
          <div>
            <label className="label">Référence libre</label>
            <input
              className="input"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Délai (jours)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={form.paymentTermsDays}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentTermsDays: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <div>
            <label className="label">Mode de règlement</label>
            <select
              className="input"
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Échéance</label>
            <input
              className="input"
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Prestation du</label>
            <input
              className="input"
              type="date"
              value={form.serviceFrom}
              onChange={(e) =>
                setForm({ ...form, serviceFrom: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">au</label>
            <input
              className="input"
              type="date"
              value={form.serviceTo}
              onChange={(e) => setForm({ ...form, serviceTo: e.target.value })}
            />
          </div>
          <div>
            <label className="label">TVA %</label>
            <input
              className="input"
              type="number"
              disabled={!draft}
              value={form.vatRate}
              onChange={(e) =>
                setForm({ ...form, vatRate: Number(e.target.value) || 0 })
              }
            />
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Lignes</h2>
            {draft && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      kind: 'transport',
                      label: '',
                      unit: 'forfait',
                      quantity: 1,
                      unitPriceHt: 0,
                    },
                  ])
                }
              >
                + Ligne
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Libellé</th>
                  <th className="px-2 py-2 text-left">Unité</th>
                  <th className="px-2 py-2 text-right">Qté</th>
                  <th className="px-2 py-2 text-right">P.U. HT</th>
                  <th className="px-2 py-2 text-right">Montant</th>
                  {draft && <th />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} className="border-t border-[var(--border)]">
                    <td className="px-2 py-2">
                      <select
                        className="input"
                        disabled={!draft}
                        value={line.kind}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, kind: e.target.value };
                          setLines(next);
                        }}
                      >
                        {LINE_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input"
                        disabled={!draft}
                        value={line.label}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, label: e.target.value };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className="input"
                        disabled={!draft}
                        value={line.unit}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, unit: e.target.value };
                          setLines(next);
                        }}
                      >
                        {LINE_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input text-right"
                        type="number"
                        disabled={!draft}
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...line,
                            quantity: Number(e.target.value) || 0,
                          };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className="input text-right"
                        type="number"
                        step={0.01}
                        disabled={!draft}
                        value={line.unitPriceHt}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...line,
                            unitPriceHt: Number(e.target.value) || 0,
                          };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-medium">
                      {formatMoney(lineAmount(line))}
                    </td>
                    {draft && (
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          className="btn-ghost text-danger text-xs"
                          disabled={lines.length <= 1}
                          onClick={() =>
                            setLines(lines.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {draft && (
            <p className="text-sm text-[var(--muted)]">
              Total calculé : HT {formatMoney(linesHt)} · TTC{' '}
              {formatMoney(linesTtc)}
            </p>
          )}
        </section>

        <section className="card grid gap-3 p-4 md:grid-cols-2">
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Mentions légales</label>
            <textarea
              className="input min-h-[80px]"
              value={form.legalMentions}
              onChange={(e) =>
                setForm({ ...form, legalMentions: e.target.value })
              }
            />
          </div>
        </section>

        <button className="btn-primary" disabled={busy}>
          Enregistrer
        </button>
      </form>

      {inv.allocations && inv.allocations.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3 font-semibold">
            Paiements ventilés
          </div>
          <table className="w-full text-sm">
            <tbody>
              {inv.allocations.map((a, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    {formatDate(a.payment.paidAt)} · {a.payment.method}
                    {a.payment.notes && (
                      <div className="text-xs text-[var(--muted)]">
                        {a.payment.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(a.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
