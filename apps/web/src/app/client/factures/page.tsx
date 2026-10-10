'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { IconInvoice, IconWallet } from '@/components/Icons';
import { badgeClass, dt, INVOICE_STATUS, money } from '../lib';

type Data = {
  invoices: Array<{
    id: string;
    number: string;
    kind: string;
    status: string;
    amountHt: number;
    amountTtc: number;
    balance: number;
    dueAt?: string | null;
    issuedAt: string;
    paidAt?: string | null;
    customerPoNumber?: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    paidAt: string;
    notes?: string | null;
  }>;
  credits: Array<{
    id: string;
    amount: number;
    remaining: number;
    notes?: string | null;
    createdAt: string;
  }>;
  openBalance: number;
};

export default function ClientInvoicesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Data>('/client-portal/invoices')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="text-sm text-rose-600">{err}</p>;
  if (!data)
    return <p className="text-sm text-[var(--cli-muted)]">Chargement…</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="cli-kicker">Comptabilité</p>
        <h1 className="cli-h1 mt-1">Facturation</h1>
        <p className="cli-sub">Factures, paiements et avoirs.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="cli-card cli-kpi-card cli-tone-teal p-5">
          <span className="cli-ico cli-ico-teal">
            <IconWallet size={18} />
          </span>
          <div className="cli-kpi-value">{money(data.openBalance)}</div>
          <div className="cli-kpi-label">Solde ouvert</div>
        </div>
        <div className="cli-card cli-kpi-card cli-tone-cyan p-5">
          <span className="cli-ico cli-ico-cyan">
            <IconInvoice size={18} />
          </span>
          <div className="cli-kpi-value">{data.invoices.length}</div>
          <div className="cli-kpi-label">Factures</div>
        </div>
        <div className="cli-card cli-kpi-card cli-tone-emerald p-5">
          <span className="cli-ico cli-ico-emerald">
            <IconWallet size={18} />
          </span>
          <div className="cli-kpi-value">{data.payments.length}</div>
          <div className="cli-kpi-label">Paiements reçus</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Factures</h2>
        {data.invoices.map((i) => {
          const late =
            !!i.dueAt && !i.paidAt && new Date(i.dueAt) < new Date();
          return (
            <div key={i.id} className="cli-card cli-list-row">
              <div className="flex gap-3">
                <span
                  className={`cli-ico ${
                    i.status === 'paid'
                      ? 'cli-ico-emerald'
                      : late
                        ? 'cli-ico-rose'
                        : 'cli-ico-amber'
                  }`}
                >
                  <IconInvoice size={18} />
                </span>
                <div>
                  <div className="font-bold">{i.number}</div>
                  <div className="text-xs text-[var(--cli-muted)]">
                    Émise le {dt(i.issuedAt, false)}
                    {i.dueAt ? ` · Échéance ${dt(i.dueAt, false)}` : ''}
                    {i.customerPoNumber ? ` · BC ${i.customerPoNumber}` : ''}
                  </div>
                  <div className="mt-2 text-sm">
                    TTC {money(i.amountTtc)} · Reste{' '}
                    <strong>
                      {money(i.balance || (i.paidAt ? 0 : i.amountTtc))}
                    </strong>
                  </div>
                </div>
              </div>
              <span
                className={badgeClass(
                  i.status === 'paid' ? 'ok' : late ? 'warn' : 'info',
                )}
              >
                {INVOICE_STATUS[i.status] || i.status}
              </span>
            </div>
          );
        })}
        {!data.invoices.length && (
          <p className="text-sm text-[var(--cli-muted)]">Aucune facture.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Paiements</h2>
        {data.payments.map((p) => (
          <div key={p.id} className="cli-card cli-list-row text-sm">
            <div className="flex gap-3">
              <span className="cli-ico cli-ico-emerald">
                <IconWallet size={16} />
              </span>
              <div>
                <div className="font-semibold">{money(p.amount)}</div>
                <div className="text-xs text-[var(--cli-muted)]">
                  {dt(p.paidAt)} · {p.method}
                  {p.notes ? ` · ${p.notes}` : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!data.payments.length && (
          <p className="text-sm text-[var(--cli-muted)]">
            Aucun paiement enregistré.
          </p>
        )}
      </section>

      {!!data.credits.length && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Avoirs / crédits</h2>
          {data.credits.map((c) => (
            <div key={c.id} className="cli-card p-4 text-sm">
              <div className="font-semibold">
                {money(c.remaining)} restant / {money(c.amount)}
              </div>
              <div className="text-xs text-[var(--cli-muted)]">
                {c.notes || 'Avoir'} · {dt(c.createdAt, false)}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
