'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, API_URL } from '@/lib/api';

type Doc = {
  id: string;
  kind: string;
  fileName: string;
  issuedAt?: string | null;
  missionId?: string | null;
};

export default function DriverDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api<Doc[]>('/portal/me/documents')
      .then(setDocs)
      .catch((e) => setErr(e.message));
  }, []);

  async function download(doc: Doc) {
    setBusyId(doc.id);
    setErr('');
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token')
          : null;
      const res = await fetch(
        `${API_URL}/portal/me/documents/${doc.id}/download`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error('Téléchargement impossible');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="bg-white px-4 pb-3 pt-3">
        <Link href="/conducteur/plus" className="text-[var(--drv-red)]">
          ← Plus
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Documents</h1>
        <p className="text-sm text-[var(--drv-muted)]">
          Documents liés à vos missions publiées
        </p>
      </div>

      <div className="space-y-2 px-4 py-4">
        {err && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}
        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => download(d)}
            disabled={busyId === d.id}
            className="drv-card flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xs font-bold text-[var(--drv-red)]">
              PDF
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                {d.fileName || d.kind}
              </span>
              <span className="block text-xs text-[var(--drv-muted)]">
                {d.kind}
                {d.issuedAt
                  ? ` · ${new Date(d.issuedAt).toLocaleDateString('fr-FR')}`
                  : ''}
              </span>
            </span>
          </button>
        ))}
        {!docs.length && !err && (
          <div className="drv-card p-6 text-center text-sm text-[var(--drv-muted)]">
            Aucun document disponible pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}
