'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, API_URL } from '@/lib/api';
import { dt } from '../lib';

type Doc = {
  id: string;
  name: string;
  category: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  uploadedAt: string;
};

export default function ClientDocumentsPage() {
  const [rows, setRows] = useState<Doc[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('bon_commande');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setRows(await api<Doc[]>('/client-portal/documents'));
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !file) {
      setErr('Nom et fichier requis');
      return;
    }
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const contentBase64 = btoa(binary);
      await api('/client-portal/documents', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
        }),
      });
      setName('');
      setFile(null);
      setOk('Document transmis');
      await load();
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string, fileName?: string | null) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_URL}/client-portal/documents/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      setErr('Téléchargement impossible');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="cli-h1">Documents</h1>
        <p className="cli-sub">
          Pièces partagées avec votre transporteur (BC, assurances, listes…).
        </p>
      </div>

      <form onSubmit={onUpload} className="cli-card space-y-3 p-4">
        <div className="font-bold">Déposer un document</div>
        <input
          className="cli-input"
          placeholder="Nom du document"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="cli-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="bon_commande">Bon de commande</option>
          <option value="assurance">Assurance</option>
          <option value="liste_passagers">Liste passagers</option>
          <option value="contrat">Contrat</option>
          <option value="autre">Autre</option>
        </select>
        <input
          type="file"
          className="text-sm"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
        <button
          type="submit"
          className="cli-btn cli-btn-primary"
          disabled={busy}
        >
          Envoyer
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((d) => (
          <li
            key={d.id}
            className="cli-card flex items-center justify-between gap-3 p-3"
          >
            <div>
              <div className="font-semibold">{d.name}</div>
              <div className="text-xs text-[var(--cli-muted)]">
                {d.category} · {dt(d.uploadedAt)}
                {d.notes ? ` · ${d.notes}` : ''}
              </div>
            </div>
            {d.fileUrl?.startsWith('file://') && (
              <button
                type="button"
                className="cli-btn cli-btn-secondary text-xs"
                onClick={() => download(d.id, d.fileName)}
              >
                Télécharger
              </button>
            )}
          </li>
        ))}
        {!rows.length && (
          <li className="text-sm text-[var(--cli-muted)]">Aucun document.</li>
        )}
      </ul>
    </div>
  );
}
