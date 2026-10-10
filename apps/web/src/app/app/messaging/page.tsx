'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { IconMail, IconPlus } from '@/components/Icons';

type UserRow = {
  id: string;
  displayName: string;
  email: string;
  employeeLink?: {
    employee: {
      firstName: string;
      lastName: string;
      matricule?: string | null;
      driver?: { id: string } | null;
    };
  } | null;
};

type ThreadListItem = {
  id: string;
  subject: string;
  status: string;
  threadType: string;
  unread?: boolean;
  lastMessageAt?: string | null;
  updatedAt: string;
  driverUser?: UserRow | null;
  assignedTo?: { id: string; displayName: string } | null;
  participants: Array<{ user: { id: string; displayName: string } }>;
  lastMessage?: {
    body: string;
    createdAt: string;
    authorId: string;
    author?: { displayName: string };
  } | null;
  _count?: { messages: number };
};

type ThreadDetail = {
  id: string;
  subject: string;
  status: string;
  threadType: string;
  driverUser?: UserRow | null;
  participants: Array<{ user: { id: string; displayName: string; email: string } }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorId: string;
    author: { id: string; displayName: string; email: string };
  }>;
};

function personLabel(u?: UserRow | null) {
  if (!u) return '—';
  const e = u.employeeLink?.employee;
  if (e) return `${e.lastName} ${e.firstName}`;
  return u.displayName || u.email;
}

function MessagingInner() {
  const { me, can } = useAuth();
  const search = useSearchParams();
  const initialThread = search.get('thread');

  const [filter, setFilter] = useState<'all' | 'driver' | 'internal'>('all');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialThread);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({
    threadType: 'driver' as 'driver' | 'internal',
    subject: '',
    body: '',
    driverUserId: '',
    participantUserIds: [] as string[],
  });

  const canWrite = can('messaging:thread:create') || !!me?.isSuperAdmin;

  const loadThreads = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('type', filter);
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    const rows = await api<ThreadListItem[]>(
      `/messaging/threads?${params.toString()}`,
    );
    setThreads(rows);
  }, [filter, status, q]);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    setErr('');
    const t = await api<ThreadDetail>(`/messaging/threads/${id}`);
    setDetail(t);
    setReply('');
    await loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    loadThreads().catch((e) => setErr(e.message));
  }, [loadThreads]);

  useEffect(() => {
    if (initialThread) {
      openThread(initialThread).catch((e) => setErr(e.message));
    }
  }, [initialThread, openThread]);

  useEffect(() => {
    if (!compose) return;
    api<UserRow[]>('/messaging/users')
      .then(setUsers)
      .catch((e) => setErr(e.message));
  }, [compose]);

  const drivers = useMemo(
    () => users.filter((u) => u.employeeLink?.employee?.driver),
    [users],
  );
  const staff = useMemo(
    () => users.filter((u) => u.id !== me?.id),
    [users, me?.id],
  );

  async function sendReply() {
    if (!activeId || !reply.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/messaging/threads/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: reply }),
      });
      setReply('');
      await openThread(activeId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createThread() {
    if (!form.subject.trim() || !form.body.trim()) {
      setErr('Objet et message requis');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const created = await api<ThreadDetail>('/messaging/threads', {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject,
          body: form.body,
          threadType: form.threadType,
          ...(form.threadType === 'driver'
            ? { driverUserId: form.driverUserId }
            : { participantUserIds: form.participantUserIds }),
        }),
      });
      setCompose(false);
      setForm({
        threadType: 'driver',
        subject: '',
        body: '',
        driverUserId: '',
        participantUserIds: [],
      });
      await loadThreads();
      await openThread(created.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setThreadStatus(next: string) {
    if (!activeId) return;
    await api(`/messaging/threads/${activeId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    await openThread(activeId);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <IconMail className="text-[var(--accent)]" />
            Messagerie
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Conversations internes et échanges avec les conducteurs du portail.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setCompose(true)}
          >
            <IconPlus size={16} />
            Nouveau message
          </button>
        )}
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_1fr]">
        <aside className="card flex min-h-0 flex-col overflow-hidden p-0">
          <div className="space-y-2 border-b border-[var(--border)] p-3">
            <div className="flex gap-1 rounded-lg bg-[var(--bg)] p-1 text-xs font-semibold">
              {(
                [
                  ['all', 'Tous'],
                  ['driver', 'Conducteurs'],
                  ['internal', 'Interne'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`flex-1 rounded-md px-2 py-1.5 ${
                    filter === k
                      ? 'bg-white shadow-sm'
                      : 'text-[var(--muted)]'
                  }`}
                  onClick={() => setFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tous statuts</option>
              <option value="new">À traiter</option>
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
            </select>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((t) => {
              const active = t.id === activeId;
              const who =
                t.threadType === 'driver'
                  ? personLabel(t.driverUser)
                  : t.participants
                      .map((p) => p.user.displayName)
                      .filter((n) => n !== me?.displayName)
                      .slice(0, 2)
                      .join(', ') || 'Équipe';
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`w-full border-b border-[var(--border)] px-3 py-3 text-left transition ${
                      active ? 'bg-[var(--accent)]/8' : 'hover:bg-[var(--bg)]'
                    }`}
                    onClick={() => openThread(t.id).catch((e) => setErr(e.message))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {t.unread && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                          )}
                          <span className="truncate text-sm font-semibold">
                            {t.subject}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {who}
                          {' · '}
                          {t.threadType === 'driver' ? 'Portail' : 'Interne'}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                          {t.lastMessage?.body || '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          t.status === 'new'
                            ? 'bg-amber-100 text-amber-800'
                            : t.status === 'closed'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {!threads.length && (
              <li className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                Aucune conversation
              </li>
            )}
          </ul>
        </aside>

        <section className="card flex min-h-0 flex-col overflow-hidden p-0">
          {!detail ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--muted)]">
              <IconMail size={36} />
              <p className="text-sm">Sélectionnez une conversation</p>
            </div>
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                <div>
                  <h2 className="text-lg font-bold">{detail.subject}</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {detail.threadType === 'driver'
                      ? `Conducteur · ${personLabel(detail.driverUser)}`
                      : `Interne · ${detail.participants.map((p) => p.user.displayName).join(', ')}`}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    {detail.status !== 'closed' ? (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => setThreadStatus('closed')}
                      >
                        Clôturer
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => setThreadStatus('open')}
                      >
                        Rouvrir
                      </button>
                    )}
                  </div>
                )}
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {detail.messages.map((m) => {
                  const mine = m.authorId === me?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg)]'
                        }`}
                      >
                        <div
                          className={`text-[10px] font-semibold ${
                            mine ? 'text-white/80' : 'text-[var(--muted)]'
                          }`}
                        >
                          {m.author.displayName} ·{' '}
                          {new Date(m.createdAt).toLocaleString('fr-FR')}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {canWrite && detail.status !== 'closed' && (
                <footer className="border-t border-[var(--border)] p-3">
                  <div className="flex gap-2">
                    <textarea
                      className="input min-h-[72px] flex-1 resize-none"
                      placeholder="Écrire une réponse…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-primary self-end"
                      disabled={busy || !reply.trim()}
                      onClick={sendReply}
                    >
                      Envoyer
                    </button>
                  </div>
                </footer>
              )}
            </>
          )}
        </section>
      </div>

      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg space-y-3 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Nouveau message</h3>
              <button
                type="button"
                className="text-sm text-[var(--muted)]"
                onClick={() => setCompose(false)}
              >
                Fermer
              </button>
            </div>
            <div className="flex gap-1 rounded-lg bg-[var(--bg)] p-1 text-xs font-semibold">
              <button
                type="button"
                className={`flex-1 rounded-md px-2 py-1.5 ${
                  form.threadType === 'driver' ? 'bg-white shadow-sm' : ''
                }`}
                onClick={() => setForm((f) => ({ ...f, threadType: 'driver' }))}
              >
                Vers conducteur
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md px-2 py-1.5 ${
                  form.threadType === 'internal' ? 'bg-white shadow-sm' : ''
                }`}
                onClick={() =>
                  setForm((f) => ({ ...f, threadType: 'internal' }))
                }
              >
                Interne (équipe)
              </button>
            </div>
            {form.threadType === 'driver' ? (
              <select
                className="input"
                value={form.driverUserId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, driverUserId: e.target.value }))
                }
              >
                <option value="">Choisir un conducteur…</option>
                {drivers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {personLabel(u)} — {u.email}
                  </option>
                ))}
              </select>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                {staff.map((u) => {
                  const checked = form.participantUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--bg)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            participantUserIds: checked
                              ? f.participantUserIds.filter((id) => id !== u.id)
                              : [...f.participantUserIds, u.id],
                          }))
                        }
                      />
                      <span>
                        {u.displayName}
                        <span className="text-[var(--muted)]"> · {u.email}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <input
              className="input"
              placeholder="Objet"
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
            />
            <textarea
              className="input min-h-[120px]"
              placeholder="Message…"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={busy}
              onClick={createThread}
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagingPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--muted)]">Chargement messagerie…</p>
      }
    >
      <MessagingInner />
    </Suspense>
  );
}
