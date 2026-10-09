'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Tab = 'today' | 'planning' | 'messages' | 'documents' | 'space';

export default function DriverPortalPage() {
  const { me, loading, login, logout, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('today');
  const [email, setEmail] = useState('conducteur@horizon-demo.fr');
  const [password, setPassword] = useState('Demo-Autocar-OS-2026!');
  const [err, setErr] = useState('');
  const [today, setToday] = useState<Record<string, unknown> | null>(null);
  const [planning, setPlanning] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [documents, setDocuments] = useState<unknown[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!me) return;
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab]);

  async function refreshData() {
    try {
      if (tab === 'today') setToday(await api('/portal/me/today'));
      if (tab === 'planning') setPlanning(await api('/portal/me/planning'));
      if (tab === 'messages') setMessages(await api('/portal/me/messages'));
      if (tab === 'documents') setDocuments(await api('/portal/me/documents'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await login(email, password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec');
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[var(--muted)]">Chargement…</div>;
  }

  if (!me) {
    return (
      <div className="space-y-4 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-action">
            AUTOCAR OS
          </p>
          <h1 className="text-2xl font-bold">Portail conducteur</h1>
          <p className="text-sm text-[var(--muted)]">
            Connexion personnelle — n’utilisez pas le téléphone en conduisant.
          </p>
        </div>
        <form onSubmit={onLogin} className="card space-y-3 p-4">
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Identifiant"
          />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
          />
          {err && <p className="text-sm text-danger">{err}</p>}
          <button className="btn-primary w-full py-3 text-base">Connexion</button>
        </form>
      </div>
    );
  }

  const next = (today as { next?: { mission: { title: string; origin?: string; destination?: string; startsAt: string }; vehicle?: { plate: string } } } | null)?.next;

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-night px-4 py-3 text-cream">
        <div className="text-xs uppercase tracking-[0.16em] text-cream/70">
          AUTOCAR OS
        </div>
        <div className="font-semibold">{me.displayName}</div>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {err && <p className="text-sm text-danger">{err}</p>}
        {note && <p className="text-sm text-ok">{note}</p>}

        {tab === 'today' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Aujourd’hui</h2>
            {next ? (
              <div className="card p-4">
                <div className="text-xs text-[var(--muted)]">Prochain service</div>
                <div className="text-lg font-semibold">{next.mission.title}</div>
                <div className="text-sm">
                  {new Date(next.mission.startsAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {next.mission.origin} → {next.mission.destination}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  Véhicule {next.vehicle?.plate || '—'}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Aucun service publié aujourd’hui.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn-primary py-3"
                onClick={async () => {
                  await api('/portal/me/ack', {
                    method: 'POST',
                    body: JSON.stringify({ kind: 'planning_seen' }),
                  });
                  setNote('Planning marqué comme vu');
                }}
              >
                J’ai vu mon planning
              </button>
              <button
                className="btn-primary py-3"
                onClick={async () => {
                  await api('/portal/me/service-event', {
                    method: 'POST',
                    body: JSON.stringify({ kind: 'service_start' }),
                  });
                  setNote('Prise de service enregistrée');
                }}
              >
                Je prends mon service
              </button>
              <button
                className="btn-ghost border border-[var(--border)] py-3"
                onClick={async () => {
                  await api('/portal/me/service-event', {
                    method: 'POST',
                    body: JSON.stringify({ kind: 'service_end' }),
                  });
                  setNote('Fin de service enregistrée');
                }}
              >
                Je termine
              </button>
              <button
                className="btn-danger py-3"
                onClick={async () => {
                  await api('/portal/me/incidents', {
                    method: 'POST',
                    body: JSON.stringify({
                      category: 'retard',
                      description: 'Retard signalé depuis le portail',
                      severity: 'medium',
                    }),
                  });
                  setNote('Incident transmis à l’exploitation');
                }}
              >
                Signaler incident
              </button>
            </div>
          </div>
        )}

        {tab === 'planning' && planning && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Planning (publié)</h2>
            <p className="text-xs text-[var(--muted)]">
              Repos et congés affichés distinctement. Non publié = invisible.
            </p>
            <div className="space-y-2">
              {(
                planning.assignments as Array<{
                  id: string;
                  startsAt: string;
                  mission: { title: string; origin?: string; destination?: string };
                  vehicle?: { plate: string };
                }>
              ).map((a) => (
                <div key={a.id} className="card p-3">
                  <div className="font-semibold">{a.mission.title}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {new Date(a.startsAt).toLocaleString('fr-FR')} ·{' '}
                    {a.mission.origin} → {a.mission.destination}
                  </div>
                  <div className="text-xs">Véhicule {a.vehicle?.plate}</div>
                </div>
              ))}
            </div>
            <h3 className="font-semibold">Repos prévus</h3>
            <ul className="text-sm">
              {(
                planning.rests as Array<{
                  id: string;
                  kind: string;
                  startsAt: string;
                  endsAt: string;
                }>
              ).map((r) => (
                <li key={r.id} className="card mb-2 p-3">
                  {r.kind} — {new Date(r.startsAt).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(r.endsAt).toLocaleDateString('fr-FR')}
                </li>
              ))}
            </ul>
            <h3 className="font-semibold">Congés / absences</h3>
            <ul className="text-sm">
              {(
                planning.leaves as Array<{
                  id: string;
                  status: string;
                  startsOn: string;
                  endsOn: string;
                }>
              ).map((l) => (
                <li key={l.id} className="card mb-2 p-3">
                  {l.status} — {new Date(l.startsOn).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(l.endsOn).toLocaleDateString('fr-FR')}
                </li>
              ))}
            </ul>
            <h3 className="font-semibold">Retour billet collectif</h3>
            <button
              className="btn-primary w-full py-3"
              onClick={async () => {
                const a = (
                  planning.assignments as Array<{ mission: { id: string } }>
                )[0];
                if (!a) {
                  setNote('Aucune mission publiée pour retour billet');
                  return;
                }
                await api('/portal/me/ticket-return', {
                  method: 'POST',
                  body: JSON.stringify({
                    missionId: a.mission.id,
                    actualPassengers: 45,
                    ticketNotes: 'Retour billet depuis portail conducteur',
                  }),
                });
                setNote('Retour de billet transmis à l’exploitation');
              }}
            >
              Confirmer retour billet (1re mission)
            </button>
          </div>
        )}

        {tab === 'messages' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Messages</h2>
            <button
              className="btn-primary w-full py-3"
              onClick={async () => {
                await api('/portal/me/messages', {
                  method: 'POST',
                  body: JSON.stringify({
                    subject: 'Contact exploitation',
                    body: 'Message depuis le portail mobile (DEMO)',
                  }),
                });
                setNote('Message envoyé');
                setMessages(await api('/portal/me/messages'));
              }}
            >
              Contacter l’exploitation
            </button>
            <pre className="card max-h-80 overflow-auto p-3 text-[10px]">
              {JSON.stringify(messages, null, 2)}
            </pre>
          </div>
        )}

        {tab === 'documents' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Documents publiés</h2>
            <pre className="card max-h-80 overflow-auto p-3 text-[10px]">
              {JSON.stringify(documents, null, 2)}
            </pre>
          </div>
        )}

        {tab === 'space' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold">Mon espace</h2>
            <button
              className="btn-primary w-full py-3"
              onClick={async () => {
                const start = new Date();
                start.setDate(start.getDate() + 30);
                const end = new Date(start);
                end.setDate(end.getDate() + 2);
                await api('/portal/me/leave', {
                  method: 'POST',
                  body: JSON.stringify({
                    startsOn: start.toISOString(),
                    endsOn: end.toISOString(),
                    comment: 'Demande depuis mobile',
                  }),
                });
                setNote('Demande de congé envoyée');
              }}
            >
              Demander un congé
            </button>
            <button
              className="btn-ghost w-full border border-[var(--border)] py-3"
              onClick={async () => {
                await logout();
                setToken(null);
                await refresh();
              }}
            >
              Déconnexion
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-lg border-t border-[var(--border)] bg-[var(--bg-elevated)]">
        {(
          [
            ['today', 'Aujourd’hui'],
            ['planning', 'Planning'],
            ['messages', 'Messages'],
            ['documents', 'Docs'],
            ['space', 'Espace'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={`flex-1 py-3 text-[11px] font-semibold ${
              tab === k ? 'text-action' : 'text-[var(--muted)]'
            }`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
