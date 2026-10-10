'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { IconBroadcast, IconMail, IconSteering } from '@/components/Icons';

type Overview = {
  drivers: Array<{
    id: string;
    employee: {
      firstName: string;
      lastName: string;
      matricule?: string | null;
      accountLink?: { user?: { id: string; displayName: string; email: string } } | null;
    };
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    createdAt: string;
    driver?: {
      employee: { firstName: string; lastName: string; matricule?: string | null };
    };
    mission?: { id: string; number: string; title: string } | null;
  }>;
  threads: Array<{
    id: string;
    subject: string;
    status: string;
    updatedAt: string;
    lastMessageAt?: string | null;
    driverUser?: {
      displayName: string;
      employeeLink?: {
        employee: { firstName: string; lastName: string; driver?: { id: string } };
      } | null;
    } | null;
    messages: Array<{ body: string; author?: { displayName: string } }>;
  }>;
  leaves: Array<{
    id: string;
    status: string;
    type: string;
    startsOn: string;
    endsOn: string;
    comment?: string | null;
    employee: {
      firstName: string;
      lastName: string;
      driver?: { id: string } | null;
    };
  }>;
  incidents: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    createdAt: string;
  }>;
  serviceEvents: Array<{
    id: string;
    kind: string;
    note?: string | null;
    createdAt: string;
    driver: {
      id: string;
      employee: { firstName: string; lastName: string; matricule?: string | null };
    };
    mission?: { id: string; number: string; title: string } | null;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    body?: string | null;
    severity: string;
    href?: string | null;
    createdAt: string;
  }>;
  ticketReturns: Array<{
    id: string;
    number: string;
    title: string;
    ticketReturnedAt?: string | null;
    actualPassengers?: number | null;
  }>;
  counts: {
    messagesNew: number;
    leavesPending: number;
    incidentsOpen: number;
    alertsOpen: number;
    ticketReturns: number;
  };
};

type Inbox = {
  feed: Array<{
    id: string;
    kind: string;
    title: string;
    body?: string;
    at: string;
    href?: string;
    severity?: string;
  }>;
  counts: Overview['counts'];
};

const KIND_LABEL: Record<string, string> = {
  service_start: 'Prise de service',
  service_end: 'Fin de service',
  planning_seen: 'Planning consulté',
};

export default function PortalOpsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [preview, setPreview] = useState('');
  const [err, setErr] = useState('');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [ov, ib] = await Promise.all([
      api<Overview>('/portal/ops/overview'),
      api<Inbox>('/portal/ops/inbox'),
    ]);
    setData(ov);
    setInbox(ib);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  if (!data) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {err || 'Chargement centre portail…'}
      </p>
    );
  }

  const c = data.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <IconBroadcast className="text-[var(--accent)]" />
            Centre portail conducteurs
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Flux temps réel du portail relié à l’exploitation — messages, prises
            de service, congés, incidents.
          </p>
        </div>
        <Link href="/app/messaging?type=driver" className="btn-primary inline-flex items-center gap-2">
          <IconMail size={16} />
          Ouvrir la messagerie
        </Link>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Messages à traiter', value: c.messagesNew, href: '/app/messaging?status=new' },
          { label: 'Congés en attente', value: c.leavesPending, href: '/app/hr/leaves' },
          { label: 'Incidents ouverts', value: c.incidentsOpen, href: '/app/quality' },
          { label: 'Alertes ops', value: c.alertsOpen },
          { label: 'Retours billets', value: c.ticketReturns },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-[var(--muted)]">{k.label}</div>
            {k.href && (
              <Link href={k.href} className="mt-2 inline-block text-xs font-semibold text-[var(--accent)]">
                Voir →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card space-y-3 p-4 xl:col-span-1">
          <h2 className="font-semibold">Fil d’activité</h2>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto text-sm">
            {(inbox?.feed || []).map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{f.title}</div>
                  <span className="shrink-0 text-[10px] text-[var(--muted)]">
                    {new Date(f.at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {f.body && (
                  <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">
                    {f.body}
                  </p>
                )}
                {f.href && (
                  <Link
                    href={f.href}
                    className="mt-1 inline-block text-xs font-semibold text-[var(--accent)]"
                  >
                    Traiter →
                  </Link>
                )}
              </li>
            ))}
            {!inbox?.feed?.length && (
              <li className="text-[var(--muted)]">Aucune activité récente.</li>
            )}
          </ul>
        </section>

        <section className="card space-y-3 p-4 xl:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Messages conducteurs</h2>
            <Link href="/app/messaging" className="text-xs font-semibold text-[var(--accent)]">
              Tout voir
            </Link>
          </div>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto text-sm">
            {data.threads.slice(0, 12).map((t) => {
              const name = t.driverUser?.employeeLink?.employee
                ? `${t.driverUser.employeeLink.employee.lastName} ${t.driverUser.employeeLink.employee.firstName}`
                : t.driverUser?.displayName || 'Conducteur';
              return (
                <li
                  key={t.id}
                  className="rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{t.subject}</div>
                      <div className="text-xs text-[var(--muted)]">{name}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        t.status === 'new'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">
                    {t.messages[0]?.body}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      className="input flex-1 text-xs"
                      placeholder="Réponse rapide…"
                      value={replyDraft[t.id] || ''}
                      onChange={(e) =>
                        setReplyDraft((d) => ({ ...d, [t.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={!replyDraft[t.id]?.trim()}
                      onClick={async () => {
                        try {
                          await api(`/messaging/threads/${t.id}/messages`, {
                            method: 'POST',
                            body: JSON.stringify({ body: replyDraft[t.id] }),
                          });
                          setReplyDraft((d) => ({ ...d, [t.id]: '' }));
                          await load();
                        } catch (e) {
                          setErr((e as Error).message);
                        }
                      }}
                    >
                      Répondre
                    </button>
                    <Link
                      href={`/app/messaging?thread=${t.id}`}
                      className="btn-secondary text-xs"
                    >
                      Ouvrir
                    </Link>
                  </div>
                </li>
              );
            })}
            {!data.threads.length && (
              <li className="text-[var(--muted)]">Aucun message.</li>
            )}
          </ul>
        </section>

        <section className="card space-y-3 p-4 xl:col-span-1">
          <h2 className="font-semibold">Prises / fins de service</h2>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto text-sm">
            {data.serviceEvents.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="font-medium">
                  {KIND_LABEL[e.kind] || e.kind} — {e.driver.employee.lastName}{' '}
                  {e.driver.employee.firstName}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {e.mission
                    ? `${e.mission.number} · ${e.mission.title}`
                    : e.note || 'Hors mission'}
                  {' · '}
                  {new Date(e.createdAt).toLocaleString('fr-FR')}
                </div>
                <Link
                  href={`/app/drivers/${e.driver.id}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
                >
                  <IconSteering size={12} /> Fiche conducteur
                </Link>
              </li>
            ))}
            {!data.serviceEvents.length && (
              <li className="text-[var(--muted)]">Aucun événement.</li>
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Congés portail (en attente)</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.leaves.map((l) => (
              <li key={l.id} className="rounded-lg border border-[var(--border)] p-3">
                <div className="font-medium">
                  {l.employee.lastName} {l.employee.firstName} — {l.type}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {new Date(l.startsOn).toLocaleDateString('fr-FR')} →{' '}
                  {new Date(l.endsOn).toLocaleDateString('fr-FR')}
                  {l.comment ? ` · ${l.comment}` : ''}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={async () => {
                      await api(`/leaves/${l.id}/decide`, {
                        method: 'POST',
                        body: JSON.stringify({ status: 'approved' }),
                      });
                      await load();
                    }}
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-xs"
                    onClick={async () => {
                      await api(`/leaves/${l.id}/decide`, {
                        method: 'POST',
                        body: JSON.stringify({
                          status: 'rejected',
                          decisionNote: 'Conflit planning',
                        }),
                      });
                      await load();
                    }}
                  >
                    Refuser
                  </button>
                  <Link href="/app/hr/leaves" className="btn-secondary text-xs">
                    RH
                  </Link>
                </div>
              </li>
            ))}
            {!data.leaves.length && (
              <li className="text-[var(--muted)]">Aucune demande.</li>
            )}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold">Incidents & retours billets</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.incidents.map((i) => (
              <li key={i.id} className="rounded-lg border border-[var(--border)] p-2">
                <strong>{i.category}</strong>
                <span className="ml-2 text-[10px] uppercase text-[var(--muted)]">
                  {i.severity}
                </span>
                <p className="text-xs text-[var(--muted)]">{i.description}</p>
              </li>
            ))}
            {data.ticketReturns.map((m) => (
              <li key={m.id} className="rounded-lg border border-[var(--border)] p-2">
                <Link
                  href={`/app/missions/${m.id}`}
                  className="font-medium text-[var(--accent)]"
                >
                  Retour billets · {m.number}
                </Link>
                <p className="text-xs text-[var(--muted)]">
                  {m.title}
                  {m.actualPassengers != null
                    ? ` · ${m.actualPassengers} pax`
                    : ''}
                </p>
              </li>
            ))}
            {!data.incidents.length && !data.ticketReturns.length && (
              <li className="text-[var(--muted)]">Rien à traiter.</li>
            )}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold">Accusés « planning vu »</h2>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
            {data.receipts.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-[var(--border)] py-1.5">
                <span>
                  {r.driver
                    ? `${r.driver.employee.lastName} ${r.driver.employee.firstName}`
                    : '—'}
                  {r.mission ? ` · ${r.mission.number}` : ''}
                  <span className="text-[var(--muted)]">
                    {' '}
                    ({KIND_LABEL[r.kind] || r.kind})
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-[var(--muted)]">
                  {new Date(r.createdAt).toLocaleString('fr-FR')}
                </span>
              </li>
            ))}
            {!data.receipts.length && (
              <li className="text-[var(--muted)]">Aucun accusé.</li>
            )}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold">Voir comme conducteur</h2>
          <p className="text-xs text-[var(--muted)]">
            Prévisualisation lecture seule du planning publié (action auditée).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.drivers
              .filter((d) => d.employee.accountLink?.user)
              .slice(0, 8)
              .map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={async () => {
                    const r = await api(`/portal/ops/as-driver/${d.id}`);
                    setPreview(JSON.stringify(r, null, 2));
                  }}
                >
                  {d.employee.lastName} {d.employee.firstName}
                </button>
              ))}
          </div>
          {preview && (
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-night/5 p-2 text-[10px]">
              {preview}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
