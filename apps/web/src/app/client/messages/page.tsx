'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dt } from '../lib';

type Msg = {
  id: string;
  subject?: string | null;
  body: string;
  authorKind: string;
  createdAt: string;
  author?: { displayName: string } | null;
};

export default function ClientMessagesPage() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [subject, setSubject] = useState('Question commerciale');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    setRows(await api<Msg[]>('/client-portal/messages'));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="cli-h1">Messages</h1>
        <p className="cli-sub">Échanges avec votre équipe commerciale.</p>
      </div>

      <form
        className="cli-card space-y-3 p-4"
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          try {
            await api('/client-portal/messages', {
              method: 'POST',
              body: JSON.stringify({ subject, body }),
            });
            setBody('');
            await load();
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
      >
        <input
          className="cli-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Objet"
        />
        <textarea
          className="cli-textarea min-h-[100px]"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Votre message…"
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button type="submit" className="cli-btn cli-btn-primary">
          Envoyer
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((m) => (
          <li
            key={m.id}
            className={`cli-card p-3 text-sm ${
              m.authorKind === 'client' ? 'border-[var(--cli-accent)]/30' : ''
            }`}
          >
            <div className="text-xs font-semibold text-[var(--cli-muted)]">
              {m.authorKind === 'client'
                ? 'Vous'
                : m.author?.displayName || 'Commercial'}{' '}
              · {dt(m.createdAt)}
            </div>
            {m.subject && <div className="mt-1 font-bold">{m.subject}</div>}
            <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
        {!rows.length && (
          <li className="text-sm text-[var(--cli-muted)]">Aucun message.</li>
        )}
      </ul>
    </div>
  );
}
