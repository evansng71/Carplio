'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, openPrintHtml } from '@/lib/api';
import { IconInvoice, IconPlus, IconTile } from '@/components/Icons';
import {
  CommercialFilters,
  compareBy,
  matchSearch,
} from '@/components/CommercialFilters';
import {
  formatDate,
  formatMoney,
  INVOICE_KIND,
  INVOICE_STATUS,
  isOverdue,
  PAYMENT_METHODS,
  statusTone,
} from '@/lib/billing';

type Invoice = {
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
  customer: { id: string; name: string };
  lines: Array<{
    id?: string;
    label: string;
    quantity: number;
    unitPriceHt: number;
    amountHt: number;
  }>;
  allocations?: Array<{
    amount: number;
    payment: { id: string; paidAt: string; method: string };
  }>;
};

type Overview = {
  count: number;
  draft: number;
  issuedTtc: number;
  paidTtc: number;
  outstanding: number;
  overdue: number;
  creditsRemaining: number;
};

type Tab = 'invoices' | 'create' | 'payments' | 'credits';

type MissionRow = {
  id: string;
  number: string;
  title: string;
  status: string;
  order: {
    customer: { id: string; name: string };
    quote?: { amountHt?: number; proposedPriceHt?: number } | null;
  };
};

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [credits, setCredits] = useState<
    Array<{ id: string; remaining: number; amount: number; customer: { name: string }; notes?: string | null }>
  >([]);
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      amount: number;
      method: string;
      paidAt: string;
      customer: { name: string };
      allocations: Array<{ amount: number; invoice: { number: string } }>;
    }>
  >([]);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [sort, setSort] = useState('date_desc');

  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('transfer');

  const [createForm, setCreateForm] = useState({
    customerId: '',
    kind: 'standard',
    vatRate: 10,
    dueAt: '',
    notes: '',
    status: 'draft',
    lines: [{ label: '', quantity: 1, unitPriceHt: 0 }],
  });

  const load = async () => {
    const [inv, ov, cr, pay, mis, cust] = await Promise.all([
      api<Invoice[]>('/billing/invoices'),
      api<Overview>('/billing/overview'),
      api('/billing/credits'),
      api('/billing/payments'),
      api<MissionRow[]>('/billing/missions-to-invoice'),
      api<Array<{ id: string; name: string }>>('/customers'),
    ]);
    setInvoices(inv);
    setOverview(ov);
    setCredits(cr);
    setPayments(pay);
    setMissions(mis);
    setCustomers(cust);
    if (!createForm.customerId && cust[0]) {
      setCreateForm((f) => ({ ...f, customerId: cust[0].id }));
    }
  };

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let rows = invoices.filter((i) => {
      if (kindFilter && i.kind !== kindFilter) return false;
      if (statusFilter === 'overdue') {
        if (!isOverdue(i)) return false;
      } else if (statusFilter && i.status !== statusFilter) {
        return false;
      }
      return matchSearch(
        [i.number, i.customer.name, i.notes, i.kind, INVOICE_STATUS[i.status]],
        search,
      );
    });
    const [key, dir] = sort.split('_') as [string, 'asc' | 'desc'];
    rows = [...rows].sort((a, b) => {
      if (key === 'date') return compareBy(a.issuedAt, b.issuedAt, dir);
      if (key === 'amount') return compareBy(a.amountTtc, b.amountTtc, dir);
      if (key === 'balance') return compareBy(a.balance, b.balance, dir);
      if (key === 'client')
        return compareBy(a.customer.name, b.customer.name, dir);
      if (key === 'number') return compareBy(a.number, b.number, dir);
      return 0;
    });
    return rows;
  }, [invoices, search, statusFilter, kindFilter, sort]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function invoiceMission(id: string, kind = 'standard') {
    setBusy(true);
    setErr('');
    try {
      await api(`/billing/invoices/from-mission/${id}`, {
        method: 'POST',
        body: JSON.stringify({ kind }),
      });
      setMsg(`Facture ${INVOICE_KIND[kind] || kind} créée`);
      setTab('invoices');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const inv = await api<Invoice>('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          dueAt: createForm.dueAt || undefined,
          lines: createForm.lines.filter((l) => l.label.trim()),
        }),
      });
      setMsg(`Facture ${inv.number} créée`);
      setCreateForm({
        customerId: createForm.customerId,
        kind: 'standard',
        vatRate: 10,
        dueAt: '',
        notes: '',
        status: 'draft',
        lines: [{ label: '', quantity: 1, unitPriceHt: 0 }],
      });
      setTab('invoices');
      await load();
      setDetail(inv);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function issue(id: string) {
    setBusy(true);
    try {
      const inv = await api<Invoice>(`/billing/invoices/${id}/issue`, {
        method: 'POST',
        body: '{}',
      });
      setMsg(`Facture ${inv.number} émise`);
      await load();
      setDetail(inv);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelInv(id: string) {
    if (!confirm('Annuler cette facture ?')) return;
    setBusy(true);
    try {
      await api(`/billing/invoices/${id}/cancel`, { method: 'POST', body: '{}' });
      setMsg('Facture annulée');
      setDetail(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function creditNote(id: string) {
    setBusy(true);
    try {
      await api(`/billing/invoices/${id}/credit-note`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Avoir client' }),
      });
      setMsg('Avoir créé');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function paySelected() {
    const open = filtered.filter(
      (i) => selected.includes(i.id) && i.balance > 0 && i.kind !== 'credit_note',
    );
    if (!open.length || payAmount <= 0) return;
    const customerId = open[0].customer.id;
    if (open.some((i) => i.customer.id !== customerId)) {
      setErr('Sélectionnez des factures du même client');
      return;
    }
    let remaining = payAmount;
    const allocs: Array<{ invoiceId: string; amount: number }> = [];
    for (const i of open) {
      if (remaining <= 0) break;
      const amount = Math.min(i.balance, remaining);
      allocs.push({ invoiceId: i.id, amount });
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
    setBusy(true);
    try {
      const r = await api<{ overpay: number }>('/billing/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          amount: payAmount,
          method: payMethod,
          allocations: allocs,
        }),
      });
      setMsg(
        r.overpay > 0
          ? `Paiement enregistré — trop-perçu ${formatMoney(r.overpay)}`
          : 'Paiement enregistré',
      );
      setSelected([]);
      setPayAmount(0);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'invoices', label: 'Factures' },
    { id: 'create', label: 'Créer' },
    { id: 'payments', label: 'Règlements' },
    { id: 'credits', label: 'Avoirs & crédits' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="amber">
            <IconInvoice />
          </IconTile>
          <div>
            <p className="page-kicker">Module commercial</p>
            <h1 className="text-2xl font-bold">Facturation</h1>
            <p className="text-sm text-[var(--muted)]">
              Factures, règlements, échéances et trop-perçus.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          onClick={() => setTab('create')}
        >
          <IconPlus size={16} />
          Nouvelle facture
        </button>
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

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Encaissé"
            value={formatMoney(overview.paidTtc)}
            tone="ok"
          />
          <Kpi
            label="Reste à encaisser"
            value={formatMoney(overview.outstanding)}
            tone="warn"
          />
          <Kpi
            label="En retard"
            value={formatMoney(overview.overdue)}
            tone="danger"
          />
          <Kpi
            label="Crédits clients"
            value={formatMoney(overview.creditsRemaining)}
            tone="info"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-b-2 border-action text-action'
                : 'text-[var(--muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <>
          <CommercialFilters
            search={search}
            onSearch={setSearch}
            searchPlaceholder="N°, client, notes…"
            filters={[
              {
                key: 'status',
                label: 'Statut',
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: '', label: 'Tous' },
                  { value: 'draft', label: 'Brouillon' },
                  { value: 'issued', label: 'Émise' },
                  { value: 'partial', label: 'Partielle' },
                  { value: 'paid', label: 'Payée' },
                  { value: 'overdue', label: 'En retard' },
                  { value: 'cancelled', label: 'Annulée' },
                ],
              },
              {
                key: 'kind',
                label: 'Type',
                value: kindFilter,
                onChange: setKindFilter,
                options: [
                  { value: '', label: 'Tous' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'supplementary', label: 'Complémentaire' },
                  { value: 'credit_note', label: 'Avoir' },
                ],
              },
            ]}
            sort={sort}
            onSort={setSort}
            sortOptions={[
              { value: 'date_desc', label: 'Date ↓' },
              { value: 'date_asc', label: 'Date ↑' },
              { value: 'amount_desc', label: 'Montant ↓' },
              { value: 'balance_desc', label: 'Solde ↓' },
              { value: 'client_asc', label: 'Client A→Z' },
              { value: 'number_asc', label: 'N°' },
            ]}
            resultCount={filtered.length}
            resultLabel="facture(s)"
          />

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Émission</th>
                  <th className="px-3 py-2 text-left">Échéance</th>
                  <th className="px-3 py-2 text-right">TTC</th>
                  <th className="px-3 py-2 text-right">Solde</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-[var(--muted)]"
                    >
                      Aucune facture pour ces critères.
                    </td>
                  </tr>
                )}
                {filtered.map((i) => (
                  <tr
                    key={i.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/50"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(i.id)}
                        onChange={() => toggle(i.id)}
                        disabled={i.balance <= 0 || i.kind === 'credit_note'}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/billing/${i.id}`}
                        className="font-semibold text-action hover:underline"
                      >
                        {i.number}
                      </Link>
                      <button
                        type="button"
                        className="ml-2 text-xs text-[var(--muted)] hover:underline"
                        onClick={() => setDetail(i)}
                      >
                        aperçu
                      </button>
                    </td>
                    <td className="px-3 py-2">{i.customer.name}</td>
                    <td className="px-3 py-2">
                      {INVOICE_KIND[i.kind] || i.kind}
                    </td>
                    <td className="px-3 py-2">{formatDate(i.issuedAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          isOverdue(i) ? 'font-medium text-rose-700' : ''
                        }
                      >
                        {formatDate(i.dueAt)}
                        {isOverdue(i) ? ' · retard' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(i.amountTtc)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(i.balance)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(i.status)}`}
                      >
                        {INVOICE_STATUS[i.status] || i.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap space-x-2 text-xs">
                      <button
                        type="button"
                        className="text-action"
                        onClick={() =>
                          openPrintHtml(
                            `/documents/print/invoice/${i.id}`,
                          ).catch((e) => setErr(e.message))
                        }
                      >
                        Imprimer
                      </button>
                      {i.status === 'draft' && (
                        <button
                          type="button"
                          className="text-action"
                          onClick={() => issue(i.id)}
                        >
                          Émettre
                        </button>
                      )}
                      {i.kind !== 'credit_note' && i.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="text-action"
                          onClick={() => creditNote(i.id)}
                        >
                          Avoir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected.length > 0 && (
            <div className="card flex flex-wrap items-end gap-3 p-4">
              <div>
                <label className="label">
                  Montant à encaisser ({selected.length} facture(s))
                </label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Mode</label>
                <select
                  className="input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || payAmount <= 0}
                onClick={paySelected}
              >
                Enregistrer le règlement
              </button>
              <p className="w-full text-xs text-[var(--muted)]">
                Le montant est ventilé automatiquement sur les factures
                sélectionnées (même client). Un trop-perçu crée un crédit.
              </p>
            </div>
          )}
        </>
      )}

      {tab === 'create' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={createInvoice} className="card space-y-3 p-4">
            <h2 className="font-semibold">Nouvelle facture manuelle</h2>
            <div>
              <label className="label">Client</label>
              <select
                className="input"
                required
                value={createForm.customerId}
                onChange={(e) =>
                  setCreateForm({ ...createForm, customerId: e.target.value })
                }
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={createForm.kind}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, kind: e.target.value })
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="supplementary">Complémentaire</option>
                </select>
              </div>
              <div>
                <label className="label">TVA %</label>
                <input
                  className="input"
                  type="number"
                  value={createForm.vatRate}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      vatRate: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Échéance</label>
                <input
                  className="input"
                  type="date"
                  value={createForm.dueAt}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, dueAt: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="label">Lignes</label>
              <div className="space-y-2">
                {createForm.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_70px_100px_auto] gap-1"
                  >
                    <input
                      className="input"
                      placeholder="Libellé"
                      value={line.label}
                      onChange={(e) => {
                        const lines = [...createForm.lines];
                        lines[idx] = { ...line, label: e.target.value };
                        setCreateForm({ ...createForm, lines });
                      }}
                      required={idx === 0}
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => {
                        const lines = [...createForm.lines];
                        lines[idx] = {
                          ...line,
                          quantity: Number(e.target.value),
                        };
                        setCreateForm({ ...createForm, lines });
                      }}
                    />
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={line.unitPriceHt}
                      onChange={(e) => {
                        const lines = [...createForm.lines];
                        lines[idx] = {
                          ...line,
                          unitPriceHt: Number(e.target.value),
                        };
                        setCreateForm({ ...createForm, lines });
                      }}
                    />
                    <button
                      type="button"
                      className="btn-ghost text-danger"
                      onClick={() =>
                        setCreateForm({
                          ...createForm,
                          lines: createForm.lines.filter((_, j) => j !== idx),
                        })
                      }
                      disabled={createForm.lines.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn-secondary mt-2 text-xs"
                onClick={() =>
                  setCreateForm({
                    ...createForm,
                    lines: [
                      ...createForm.lines,
                      { label: '', quantity: 1, unitPriceHt: 0 },
                    ],
                  })
                }
              >
                + Ligne
              </button>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input min-h-[60px]"
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm({ ...createForm, notes: e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  setCreateForm((f) => ({ ...f, status: 'draft' }))
                }
              >
                Enregistrer brouillon
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  setCreateForm((f) => ({ ...f, status: 'issued' }))
                }
              >
                Créer et émettre
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Total HT estimé :{' '}
              {formatMoney(
                createForm.lines.reduce(
                  (s, l) => s + l.quantity * l.unitPriceHt,
                  0,
                ),
              )}{' '}
              · TTC :{' '}
              {formatMoney(
                createForm.lines.reduce(
                  (s, l) => s + l.quantity * l.unitPriceHt,
                  0,
                ) *
                  (1 + createForm.vatRate / 100),
              )}
            </p>
          </form>

          <section className="card p-4">
            <h2 className="font-semibold">Depuis une mission</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Crée une facture à partir du devis / mission lié.
            </p>
            <div className="max-h-[480px] space-y-2 overflow-y-auto">
              {missions.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  Aucune mission à facturer.
                </p>
              )}
              {missions.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div>
                    <div className="font-medium">
                      {m.number} — {m.title}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {m.order.customer.name} · {m.status}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy}
                      onClick={() => invoiceMission(m.id)}
                    >
                      Facturer
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => invoiceMission(m.id, 'supplementary')}
                      title="Complémentaire"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-left">Ventilation</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    Aucun règlement enregistré.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">{formatDate(p.paidAt)}</td>
                  <td className="px-4 py-3">{p.customer.name}</td>
                  <td className="px-4 py-3">
                    {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ||
                      p.method}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {p.allocations
                      .map(
                        (a) =>
                          `${a.invoice.number} (${formatMoney(a.amount)})`,
                      )
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'credits' && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Trop-perçus / crédits ouverts</h2>
          {credits.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Aucun crédit ouvert.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {credits.map((c) => (
                <li
                  key={c.id}
                  className="flex justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span>
                    <strong>{c.customer.name}</strong>
                    {c.notes ? (
                      <span className="text-[var(--muted)]"> — {c.notes}</span>
                    ) : null}
                  </span>
                  <span className="font-medium text-emerald-700">
                    {formatMoney(c.remaining)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-[var(--muted)]">
            Les avoirs (factures de type Avoir) apparaissent aussi dans l’onglet
            Factures.
          </p>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{detail.number}</h2>
                <p className="text-sm text-[var(--muted)]">
                  {detail.customer.name} ·{' '}
                  {INVOICE_KIND[detail.kind] || detail.kind}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDetail(null)}
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${statusTone(detail.status)}`}
              >
                {INVOICE_STATUS[detail.status] || detail.status}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Émise {formatDate(detail.issuedAt)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">
                Échéance {formatDate(detail.dueAt)}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)]">
                  <th className="py-1">Libellé</th>
                  <th className="py-1">Qté</th>
                  <th className="py-1 text-right">HT</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={l.id || i} className="border-t border-[var(--border)]">
                    <td className="py-1.5">{l.label}</td>
                    <td className="py-1.5">{l.quantity}</td>
                    <td className="py-1.5 text-right">
                      {formatMoney(l.amountHt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right text-sm">
              <div>HT {formatMoney(detail.amountHt)}</div>
              <div>TVA {detail.vatRate} %</div>
              <div className="text-base font-bold">
                TTC {formatMoney(detail.amountTtc)}
              </div>
              <div className="text-[var(--muted)]">
                Solde {formatMoney(detail.balance)}
              </div>
            </div>
            {detail.notes && (
              <p className="text-sm text-[var(--muted)]">{detail.notes}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  openPrintHtml(`/documents/print/invoice/${detail.id}`).catch(
                    (e) => setErr(e.message),
                  )
                }
              >
                Imprimer
              </button>
              {detail.status === 'draft' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => issue(detail.id)}
                >
                  Émettre
                </button>
              )}
              {detail.status !== 'paid' && detail.status !== 'cancelled' && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => cancelInv(detail.id)}
                >
                  Annuler
                </button>
              )}
              <Link
                href="/app/admin/templates"
                className="btn-ghost text-sm text-action"
              >
                Modèle d’impression…
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'warn' | 'danger' | 'info';
}) {
  const bg =
    tone === 'ok'
      ? 'bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-950'
        : tone === 'danger'
          ? 'bg-rose-50 text-rose-900'
          : 'bg-sky-50 text-sky-900';
  return (
    <div className={`rounded-xl px-4 py-3 ${bg}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
