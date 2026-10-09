'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type Scenario = {
  id: string;
  code: string;
  name: string;
  prepMin: number;
  approachHlpMin: number;
  returnHlpMin: number;
  cashMin: number;
  finishMin: number;
  paidBreakMin: number;
};

type Block = {
  id: string;
  sequence: number;
  kind: string;
  label: string;
  startsAt: string;
  endsAt: string;
  distanceKm: number;
  paid: boolean;
  locked: boolean;
  fromLocation?: string;
  toLocation?: string;
};

type Run = {
  id: string;
  status: string;
  totalMin: number;
  totalKm: number;
  workDate: string;
  scenario: Scenario;
  driver?: { employee: { firstName: string; lastName: string } };
  blocks: Block[];
};

const KIND_COLOR: Record<string, string> = {
  duty_start: 'bg-night',
  hlp_approach: 'bg-warn',
  commercial: 'bg-action',
  paid_break: 'bg-ok',
  cash: 'bg-night/70',
  hlp_return: 'bg-warn',
  duty_end: 'bg-night',
};

function DressingInner() {
  const sp = useSearchParams();
  const assignmentId = sp.get('assignmentId') || '';
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [assignments, setAssignments] = useState<
    Array<{ id: string; mission: { number: string; title: string }; startsAt: string }>
  >([]);
  const [selectedAssignment, setSelectedAssignment] = useState(assignmentId);
  const [msg, setMsg] = useState('');
  const [drivers, setDrivers] = useState<Array<{ id: string; employee: { firstName: string; lastName: string } }>>([]);

  const load = async () => {
    const sc = await api<Scenario[]>('/dressing/scenarios');
    setScenarios(sc);
    if (sc[0] && !scenarioId) setScenarioId(sc[0].id);
    const board = await api<{ assignments: typeof assignments }>(
      `/planning/board?mode=fortnight&from=${new Date().toISOString()}`,
    );
    setAssignments(board.assignments);
    if (!selectedAssignment && board.assignments[0]) {
      setSelectedAssignment(board.assignments[0].id);
    }
    const list = await api<Run[]>('/dressing/runs');
    setRuns(list);
    if (list[0] && !run) setRun(list[0]);
    api('/drivers').then(setDrivers);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timeline = useMemo(() => {
    if (!run?.blocks?.length) return null;
    const start = Math.min(...run.blocks.map((b) => new Date(b.startsAt).getTime()));
    const end = Math.max(...run.blocks.map((b) => new Date(b.endsAt).getTime()));
    return { start, end, span: Math.max(end - start, 1) };
  }, [run]);

  async function generate() {
    if (!selectedAssignment || !scenarioId) return;
    const r = await api<Run>('/dressing/generate', {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: selectedAssignment,
        scenarioId,
        keepLocked: true,
      }),
    });
    setRun(r);
    setMsg('Habillage généré (HLP + temps annexes)');
    load();
  }

  async function toggleLock(block: Block) {
    await api(`/dressing/blocks/${block.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ locked: !block.locked }),
    });
    if (run) {
      const refreshed = await api<Run>(`/dressing/runs/${run.id}`);
      setRun(refreshed);
    }
  }

  async function rehab(driverId?: string) {
    if (!run) return;
    const r = await api<Run>(`/dressing/runs/${run.id}/rehab`, {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    });
    setRun(r);
    setMsg('Réhabillage effectué (blocs verrouillés conservés)');
  }

  async function createScenario() {
    await api('/dressing/scenarios', {
      method: 'POST',
      body: JSON.stringify({
        code: `HAB-${Date.now().toString(36)}`,
        name: 'Scénario personnalisé',
        prepMin: 15,
        approachHlpMin: 25,
        returnHlpMin: 25,
        cashMin: 5,
        finishMin: 10,
        paidBreakMin: 15,
      }),
    });
    setMsg('Scénario créé');
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Habillage HLP — graphique à plat</h1>
        <p className="text-sm text-[var(--muted)]">
          Prise/fin, HLP, course, caisse, coupures — édition et réhabillage.
        </p>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}

      <div className="card grid gap-3 p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">Affectation source</label>
          <select
            className="input"
            value={selectedAssignment}
            onChange={(e) => setSelectedAssignment(e.target.value)}
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.mission.number} — {a.mission.title} (
                {new Date(a.startsAt).toLocaleDateString('fr-FR')})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Scénario</label>
          <select
            className="input"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn-primary flex-1" onClick={generate}>
            Générer
          </button>
          <button className="btn-ghost border border-[var(--border)]" onClick={createScenario}>
            +
          </button>
        </div>
      </div>

      {run && timeline && (
        <section className="card space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">
                Run {run.status} · {run.totalMin} min · {run.totalKm} km
              </div>
              <div className="text-sm text-[var(--muted)]">
                {run.driver
                  ? `${run.driver.employee.firstName} ${run.driver.employee.lastName}`
                  : 'Sans conducteur'}{' '}
                · scénario {run.scenario.code}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {drivers.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  className="btn-ghost border border-[var(--border)]"
                  onClick={() => rehab(d.id)}
                >
                  Réhabiller → {d.employee.firstName}
                </button>
              ))}
            </div>
          </div>

          {/* Graphique à plat */}
          <div className="relative h-20 overflow-hidden rounded-xl bg-night/5">
            {run.blocks.map((b) => {
              const left =
                ((new Date(b.startsAt).getTime() - timeline.start) / timeline.span) * 100;
              const width =
                ((new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) /
                  timeline.span) *
                100;
              return (
                <button
                  key={b.id}
                  type="button"
                  title={`${b.label} (${b.kind})`}
                  onClick={() => toggleLock(b)}
                  className={`absolute top-3 h-14 overflow-hidden rounded-md px-1 text-[10px] font-semibold text-white ${
                    KIND_COLOR[b.kind] || 'bg-action'
                  } ${b.locked ? 'ring-2 ring-cream' : ''}`}
                  style={{
                    left: `${Math.max(left, 0)}%`,
                    width: `${Math.max(width, 2)}%`,
                  }}
                >
                  {b.label}
                  {b.locked ? ' 🔒' : ''}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--muted)]">
            Cliquez un bloc pour verrouiller/déverrouiller (conservé au réhabillage).
          </p>

          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Nature</th>
                  <th className="px-2 py-2">Début</th>
                  <th className="px-2 py-2">Fin</th>
                  <th className="px-2 py-2">Km</th>
                  <th className="px-2 py-2">Lieux</th>
                  <th className="px-2 py-2">Payé</th>
                  <th className="px-2 py-2">Verrou</th>
                </tr>
              </thead>
              <tbody>
                {run.blocks.map((b) => (
                  <tr key={b.id} className="border-t border-[var(--border)]">
                    <td className="px-2 py-2">{b.sequence}</td>
                    <td className="px-2 py-2 font-medium">{b.label}</td>
                    <td className="px-2 py-2">
                      {new Date(b.startsAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-2">
                      {new Date(b.endsAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-2">{b.distanceKm}</td>
                    <td className="px-2 py-2 text-xs">
                      {b.fromLocation} → {b.toLocation}
                    </td>
                    <td className="px-2 py-2">{b.paid ? 'oui' : 'non'}</td>
                    <td className="px-2 py-2">
                      <button className="text-action" onClick={() => toggleLock(b)}>
                        {b.locked ? 'Verrouillé' : 'Libre'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card p-4">
        <h2 className="font-semibold">Historique des runs</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {runs.map((r) => (
            <li key={r.id}>
              <button className="text-action hover:underline" onClick={() => setRun(r)}>
                {new Date(r.workDate).toLocaleDateString('fr-FR')} — {r.totalMin} min /{' '}
                {r.totalKm} km — {r.blocks?.length || 0} blocs
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function DressingPage() {
  return (
    <Suspense>
      <DressingInner />
    </Suspense>
  );
}
