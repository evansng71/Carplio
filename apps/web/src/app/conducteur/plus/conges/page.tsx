'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LEAVE_LABEL } from '../../lib';

type Leaves = {
  year: number;
  requests: Array<{
    id: string;
    type: string;
    status: string;
    startsOn: string;
    endsOn: string;
    comment?: string | null;
  }>;
  balances: Array<{
    type: string;
    entitled: number;
    used: number;
    remaining: number;
  }>;
};

const STATUS: Record<string, string> = {
  submitted: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  cancelled: 'Annulé',
};

export default function DriverLeavesPage() {
  const [data, setData] = useState<Leaves | null>(null);
  const [form, setForm] = useState({
    type: 'conges',
    startsOn: '',
    endsOn: '',
    comment: '',
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setData(await api<Leaves>('/portal/me/leaves'));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="bg-white px-4 pb-3 pt-3">
        <Link href="/conducteur/plus" className="text-[var(--drv-red)]">
          ← Plus
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Congés & absences</h1>
      </div>

      <div className="space-y-4 px-4 py-4">
        {(err || ok) && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            {err || ok}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {(data?.balances || []).map((b) => (
            <div key={b.type} className="drv-card p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-[var(--drv-muted)]">
                {LEAVE_LABEL[b.type] || b.type}
              </div>
              <div className="text-2xl font-black tabular-nums">
                {b.remaining}
              </div>
              <div className="text-[10px] text-[var(--drv-muted)]">
                / {b.entitled} j
              </div>
            </div>
          ))}
        </div>

        <section className="drv-card space-y-3 p-4">
          <h2 className="font-bold">Nouvelle demande</h2>
          <select
            className="drv-input"
            value={form.type}
            onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
          >
            {Object.entries(LEAVE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-[var(--drv-muted)]">
              Du
              <input
                type="date"
                className="drv-input mt-1"
                value={form.startsOn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, startsOn: e.target.value }))
                }
              />
            </label>
            <label className="text-xs font-semibold text-[var(--drv-muted)]">
              Au
              <input
                type="date"
                className="drv-input mt-1"
                value={form.endsOn}
                onChange={(e) =>
                  setForm((s) => ({ ...s, endsOn: e.target.value }))
                }
              />
            </label>
          </div>
          <input
            className="drv-input"
            placeholder="Motif (optionnel)"
            value={form.comment}
            onChange={(e) =>
              setForm((s) => ({ ...s, comment: e.target.value }))
            }
          />
          <button
            type="button"
            className="drv-btn-black"
            disabled={busy || !form.startsOn || !form.endsOn}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await api('/portal/me/leave', {
                  method: 'POST',
                  body: JSON.stringify(form),
                });
                setOk('Demande envoyée à la RH');
                setForm((s) => ({
                  ...s,
                  startsOn: '',
                  endsOn: '',
                  comment: '',
                }));
                await load();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer la demande
          </button>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold">Mes demandes</h2>
          {(data?.requests || []).map((r) => (
            <div key={r.id} className="drv-card p-3">
              <div className="flex justify-between gap-2">
                <span className="font-bold">
                  {LEAVE_LABEL[r.type] || r.type}
                </span>
                <span className="text-xs font-semibold text-[var(--drv-muted)]">
                  {STATUS[r.status] || r.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-[var(--drv-muted)]">
                {new Date(r.startsOn).toLocaleDateString('fr-FR')} →{' '}
                {new Date(r.endsOn).toLocaleDateString('fr-FR')}
              </div>
              {r.comment && (
                <p className="mt-1 text-xs text-[var(--drv-muted)]">
                  {r.comment}
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
