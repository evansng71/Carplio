'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function WorkshopPage() {
  const [tab, setTab] = useState<'alerts' | 'or' | 'stock' | 'fuel'>('alerts');
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; status: string; vehicle: { fleetNumber: string }; dueKm?: number }>>([]);
  const [repairs, setRepairs] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [wos, setWos] = useState<Array<{ id: string; number: string; status: string; immobilized: boolean; vehicle: { fleetNumber: string }; links: unknown[] }>>([]);
  const [parts, setParts] = useState<Array<{ id: string; sku: string; name: string; qty: number; minQty: number }>>([]);
  const [fuel, setFuel] = useState<Array<{ id: string; liters: number; status: string; source: string; vehicle?: { plate: string } }>>([]);
  const [vehicles, setVehicles] = useState<Array<{ id: string; fleetNumber: string; plate: string }>>([]);
  const [msg, setMsg] = useState('');
  const [selAlerts, setSelAlerts] = useState<string[]>([]);
  const [selRepairs, setSelRepairs] = useState<string[]>([]);

  const load = () => {
    api('/workshop/alerts').then(setAlerts);
    api('/workshop/repairs').then(setRepairs);
    api('/workshop/work-orders').then(setWos);
    api('/workshop/parts').then(setParts);
    api('/workshop/fuel').then(setFuel);
    api('/vehicles').then(setVehicles);
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Atelier / Parc</h1>
        <p className="text-sm text-[var(--muted)]">
          Alertes, signalements, OR multi-sources, stocks, carburant.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['alerts', 'Alertes & signalements'],
            ['or', 'Ordres de réparation'],
            ['stock', 'Stocks / BC'],
            ['fuel', 'Carburant'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'alerts' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold">Alertes planifiées</h2>
            <button
              className="btn-primary"
              onClick={async () => {
                if (!vehicles[0]) return;
                await api('/workshop/alerts', {
                  method: 'POST',
                  body: JSON.stringify({
                    vehicleId: vehicles[0].id,
                    kind: 'km',
                    title: 'Révision 20 000 km',
                    dueKm: 20000,
                  }),
                });
                setMsg('Alerte créée');
                load();
              }}
            >
              + Alerte km
            </button>
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded border border-[var(--border)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selAlerts.includes(a.id)}
                    onChange={() =>
                      setSelAlerts((s) =>
                        s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id],
                      )
                    }
                  />
                  <span>
                    {a.vehicle.fleetNumber} — {a.title} ({a.status})
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold">Signalements</h2>
            <button
              className="btn-primary"
              onClick={async () => {
                await api('/workshop/repairs', {
                  method: 'POST',
                  body: JSON.stringify({
                    vehicleId: vehicles[0]?.id,
                    title: 'Bruit frein AV',
                    description: 'Signalement exploitation DEMO',
                    source: 'ops',
                  }),
                });
                setMsg('Signalement créé');
                load();
              }}
            >
              + Signalement
            </button>
            <ul className="space-y-2 text-sm">
              {repairs.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded border border-[var(--border)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selRepairs.includes(r.id)}
                    onChange={() =>
                      setSelRepairs((s) =>
                        s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id],
                      )
                    }
                  />
                  {r.title} ({r.status})
                </li>
              ))}
            </ul>
            <button
              className="btn-primary"
              onClick={async () => {
                if (!vehicles[0]) return;
                await api('/workshop/work-orders', {
                  method: 'POST',
                  body: JSON.stringify({
                    vehicleId: vehicles[0].id,
                    diagnosis: 'Contrôle freinage + révision',
                    alertIds: selAlerts,
                    repairIds: selRepairs,
                    immobilize: true,
                    tasks: [
                      { label: 'Diagnostic', hours: 1 },
                      { label: 'Remplacement plaquettes', hours: 2 },
                    ],
                  }),
                });
                setMsg('OR créé (multi-sources) + immobilisation planning');
                setSelAlerts([]);
                setSelRepairs([]);
                load();
              }}
            >
              Créer OR depuis sélection
            </button>
          </section>
        </div>
      )}

      {tab === 'or' && (
        <div className="space-y-3">
          {wos.map((w) => (
            <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <div className="font-semibold">
                  {w.number} — {w.vehicle.fleetNumber}
                </div>
                <div className="text-[var(--muted)]">
                  {w.status} · {w.links.length} source(s) ·{' '}
                  {w.immobilized ? 'immobilisé' : 'roulant'}
                </div>
              </div>
              {w.status !== 'closed' && (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    await api(`/workshop/work-orders/${w.id}/close`, {
                      method: 'POST',
                      body: JSON.stringify({ partsCost: 120, laborHours: 3 }),
                    });
                    setMsg('OR clôturé — véhicule libéré');
                    load();
                  }}
                >
                  Clôturer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'stock' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                const p = await api<{ id: string }>('/workshop/parts', {
                  method: 'POST',
                  body: JSON.stringify({
                    sku: `P-${Date.now().toString(36)}`,
                    name: 'Plaquettes frein',
                    qty: 4,
                    minQty: 2,
                    unitCost: 45,
                  }),
                });
                await api('/workshop/purchase-orders', {
                  method: 'POST',
                  body: JSON.stringify({
                    supplier: 'Pièces Bus SA',
                    lines: [{ partId: p.id, qty: 10, unitCost: 40 }],
                  }),
                });
                setMsg('Pièce + BC créés');
                load();
              }}
            >
              + Pièce & BC
            </button>
            <button
              className="btn-ghost border border-[var(--border)]"
              onClick={async () => {
                const pos = await api<Array<{ id: string; status: string }>>(
                  '/workshop/purchase-orders',
                );
                const open = pos.find((p) => p.status === 'ordered');
                if (!open) return;
                await api(`/workshop/purchase-orders/${open.id}/deliver`, {
                  method: 'POST',
                  body: '{}',
                });
                setMsg('BL reçu — stock incrémenté');
                load();
              }}
            >
              Réceptionner BL
            </button>
          </div>
          <div className="card divide-y divide-[var(--border)]">
            {parts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {p.sku} — {p.name}
                </span>
                <span className={p.qty <= p.minQty ? 'text-danger' : ''}>
                  Stock {p.qty} (min {p.minQty})
                </span>
                <button
                  className="text-action"
                  onClick={async () => {
                    await api(`/workshop/parts/${p.id}/move`, {
                      method: 'POST',
                      body: JSON.stringify({ kind: 'out', quantity: 1, note: 'Sortie OR' }),
                    });
                    load();
                  }}
                >
                  Sortir 1
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'fuel' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={async () => {
                await api('/workshop/fuel', {
                  method: 'POST',
                  body: JSON.stringify({
                    vehicleId: vehicles[0]?.id,
                    liters: 180,
                    amount: 270,
                    odometerKm: 125000,
                  }),
                });
                setMsg('Saisie manuelle à contrôler');
                load();
              }}
            >
              Saisie manuelle
            </button>
            <button
              className="btn-ghost border border-[var(--border)]"
              onClick={async () => {
                await api('/workshop/fuel/import', {
                  method: 'POST',
                  body: JSON.stringify({
                    rows: [
                      {
                        plate: vehicles[0]?.plate,
                        liters: 200,
                        amount: 300,
                        odometerKm: 125400,
                      },
                      { plate: 'ZZ-999-ZZ', liters: 50, amount: 80 },
                    ],
                  }),
                });
                setMsg('Import automate — lignes à contrôler');
                load();
              }}
            >
              Import fichier automate
            </button>
          </div>
          {fuel.map((f) => (
            <div key={f.id} className="card flex items-center justify-between p-3 text-sm">
              <span>
                {f.vehicle?.plate || '—'} · {f.liters} L · {f.source} · {f.status}
              </span>
              {f.status === 'to_check' && (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    await api(`/workshop/fuel/${f.id}/validate`, {
                      method: 'POST',
                      body: JSON.stringify({ note: 'Validé DEMO' }),
                    });
                    load();
                  }}
                >
                  Valider
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
