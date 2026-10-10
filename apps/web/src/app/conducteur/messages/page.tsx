'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Thread = {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  unread?: boolean;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorId?: string;
    author?: { displayName: string };
  }>;
};

export default function DriverMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('Contact exploitation');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const rows = await api<Thread[]>('/portal/me/messages');
    setThreads(rows);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return threads;
    return threads.filter((t) => {
      const last = t.messages[t.messages.length - 1]?.body || '';
      return (
        t.subject.toLowerCase().includes(s) || last.toLowerCase().includes(s)
      );
    });
  }, [threads, q]);

  return (
    <div className="bg-white min-h-dvh">
      <div className="px-4 pb-3 pt-3">
        <Link href="/conducteur" className="text-[var(--drv-red)]" aria-label="Retour">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mes messages</h1>
          <button
            type="button"
            className="text-sm font-bold text-[var(--drv-red)]"
            onClick={() => setCompose((v) => !v)}
          >
            {compose ? 'Annuler' : 'Écrire'}
          </button>
        </div>
        <div className="relative mt-3">
          <input
            className="drv-input pr-10"
            placeholder="Rechercher"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            ⌕
          </span>
        </div>
      </div>

      {(err || ok) && (
        <div
          className={`mx-4 mb-2 rounded-xl px-3 py-2 text-sm ${
            err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || ok}
        </div>
      )}

      {compose && (
        <div className="mx-4 mb-4 space-y-2 rounded-2xl border border-gray-100 p-3">
          <input
            className="drv-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Objet"
          />
          <textarea
            className="drv-input min-h-[100px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Votre message à l’exploitation…"
          />
          <button
            type="button"
            className="drv-btn-black"
            disabled={busy || !body.trim()}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await api('/portal/me/messages', {
                  method: 'POST',
                  body: JSON.stringify({ subject, body }),
                });
                setBody('');
                setCompose(false);
                setOk('Message envoyé');
                await load();
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer
          </button>
        </div>
      )}

      <div className="px-2 pb-6">
        <p className="px-2 pb-2 text-xs font-bold uppercase text-[var(--drv-muted)]">
          Conversations
        </p>
        <ul>
          {filtered.map((t) => {
            const last = t.messages[t.messages.length - 1];
            const open = openId === t.id;
            return (
              <li key={t.id} className="border-b border-gray-100">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                  onClick={async () => {
                    const next = open ? null : t.id;
                    setOpenId(next);
                    if (next) {
                      try {
                        await api(`/portal/me/messages/${t.id}/read`, {
                          method: 'POST',
                        });
                        await load();
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
                      t.unread ? 'bg-orange-500' : 'bg-teal-600'
                    }`}
                  >
                    {t.unread ? '!' : '↔'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`truncate ${t.unread ? 'font-bold' : 'font-semibold'}`}>
                        {t.subject}
                      </div>
                      <div className="shrink-0 text-[11px] text-[var(--drv-muted)]">
                        {new Date(t.updatedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </div>
                    </div>
                    <p className="truncate text-sm text-[var(--drv-muted)]">
                      {last?.body || '—'}
                    </p>
                  </div>
                </button>
                {open && (
                  <div className="space-y-2 bg-gray-50 px-4 py-3">
                    {t.messages.map((m) => (
                      <div key={m.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                        <div className="text-[10px] font-semibold text-[var(--drv-muted)]">
                          {m.author?.displayName || '—'} ·{' '}
                          {new Date(m.createdAt).toLocaleString('fr-FR')}
                        </div>
                        <p className="mt-1">{m.body}</p>
                      </div>
                    ))}
                    <ReplyBox
                      threadId={t.id}
                      onSent={async () => {
                        setOk('Réponse envoyée');
                        await load();
                      }}
                      onError={(m) => setErr(m)}
                    />
                  </div>
                )}
              </li>
            );
          })}
          {!filtered.length && (
            <li className="px-4 py-10 text-center text-sm text-[var(--drv-muted)]">
              Aucun message
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function ReplyBox({
  threadId,
  onSent,
  onError,
}: {
  threadId: string;
  onSent: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        className="drv-input flex-1"
        placeholder="Répondre…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="rounded-xl bg-[var(--drv-red)] px-3 text-sm font-bold text-white"
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/portal/me/messages', {
              method: 'POST',
              body: JSON.stringify({ threadId, body: text }),
            });
            setText('');
            await onSent();
          } catch (e) {
            onError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        OK
      </button>
    </div>
  );
}
