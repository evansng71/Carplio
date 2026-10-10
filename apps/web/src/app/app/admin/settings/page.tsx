'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BrandMark } from '@/components/BrandMark';
import {
  Branding,
  FALLBACK_BRANDING,
  fetchBranding,
  readImageAsDataUrl,
} from '@/lib/branding';

export default function AdminSettingsPage() {
  const { can, me } = useAuth();
  const allowed = can('settings:company:manage') || me?.isSuperAdmin;
  const [branding, setBranding] = useState<Branding>(FALLBACK_BRANDING);
  const [form, setForm] = useState({
    companyName: '',
    tradeName: '',
    siret: '',
    vatNumber: '',
    brandName: '',
    brandTagline: '',
    loginHeadline: '',
    loginSubheadline: '',
    loginFooterText: '',
    logoUrl: '' as string | null,
    loginHeroImageUrl: '' as string | null,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchBranding().then((b) => {
      setBranding(b);
      setForm({
        companyName: b.companyName,
        tradeName: b.tradeName || '',
        siret: (b as Branding & { siret?: string | null }).siret || '',
        vatNumber: (b as Branding & { vatNumber?: string | null }).vatNumber || '',
        brandName: b.brandName,
        brandTagline: b.brandTagline,
        loginHeadline: b.loginHeadline,
        loginSubheadline: b.loginSubheadline,
        loginFooterText: b.loginFooterText,
        logoUrl: b.logoUrl,
        loginHeroImageUrl: b.loginHeroImageUrl,
      });
    });
  }, []);

  if (!allowed) {
    return (
      <div className="card p-6 text-sm text-[var(--muted)]">
        Accès réservé aux administrateurs société.
      </div>
    );
  }

  async function onUpload(
    field: 'logoUrl' | 'loginHeroImageUrl',
    file: File | null,
  ) {
    if (!file) return;
    setErr('');
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setForm((f) => ({ ...f, [field]: dataUrl }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const updated = await api<Branding>('/org/branding', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: form.companyName,
          tradeName: form.tradeName || null,
          siret: form.siret || null,
          vatNumber: form.vatNumber || null,
          brandName: form.brandName,
          brandTagline: form.brandTagline,
          loginHeadline: form.loginHeadline,
          loginSubheadline: form.loginSubheadline,
          loginFooterText: form.loginFooterText,
          logoUrl: form.logoUrl || null,
          loginHeroImageUrl: form.loginHeroImageUrl || null,
        }),
      });
      setBranding(updated);
      setMsg('Paramètres enregistrés.');
    } catch (e) {
      setErr((e as Error).message || 'Échec enregistrement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/app/admin"
          className="text-xs font-semibold text-action hover:underline"
        >
          ← Administration
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Paramètres système</h1>
        <p className="text-sm text-[var(--muted)]">
          Identité société, logos et apparence de la page de connexion.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Société</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Raison sociale</label>
              <input
                className="input"
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label">Enseigne / nom commercial</label>
              <input
                className="input"
                value={form.tradeName}
                onChange={(e) =>
                  setForm({ ...form, tradeName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">SIRET</label>
              <input
                className="input"
                value={form.siret}
                onChange={(e) => setForm({ ...form, siret: e.target.value })}
              />
            </div>
            <div>
              <label className="label">N° TVA</label>
              <input
                className="input"
                value={form.vatNumber}
                onChange={(e) =>
                  setForm({ ...form, vatNumber: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Marque affichée</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nom de marque</label>
              <input
                className="input"
                value={form.brandName}
                onChange={(e) =>
                  setForm({ ...form, brandName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Accroche / tagline</label>
              <input
                className="input"
                value={form.brandTagline}
                onChange={(e) =>
                  setForm({ ...form, brandTagline: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Titre panneau connexion</label>
            <input
              className="input"
              value={form.loginHeadline}
              onChange={(e) =>
                setForm({ ...form, loginHeadline: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Sous-titre</label>
            <textarea
              className="input min-h-[72px]"
              value={form.loginSubheadline}
              onChange={(e) =>
                setForm({ ...form, loginSubheadline: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Texte bas de panneau</label>
            <input
              className="input"
              value={form.loginFooterText}
              onChange={(e) =>
                setForm({ ...form, loginFooterText: e.target.value })
              }
            />
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Logo</h2>
          <div className="flex flex-wrap items-center gap-6">
            <BrandMark
              logoUrl={form.logoUrl}
              brandName={form.brandName || branding.brandName}
              size="lg"
              showWordmark={false}
            />
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                className="block text-sm"
                onChange={(e) =>
                  onUpload('logoUrl', e.target.files?.[0] || null)
                }
              />
              <input
                className="input max-w-md"
                placeholder="Ou URL https://…"
                value={
                  form.logoUrl && !form.logoUrl.startsWith('data:')
                    ? form.logoUrl
                    : ''
                }
                onChange={(e) =>
                  setForm({ ...form, logoUrl: e.target.value || null })
                }
              />
              {form.logoUrl && (
                <button
                  type="button"
                  className="btn-ghost text-sm text-danger"
                  onClick={() => setForm({ ...form, logoUrl: null })}
                >
                  Retirer le logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Grande image (connexion)</h2>
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                form.loginHeroImageUrl || FALLBACK_BRANDING.loginHeroImageUrl
              }
              alt="Aperçu image de connexion"
              className="h-48 w-full object-cover"
            />
          </div>
          <input
            type="file"
            accept="image/*"
            className="block text-sm"
            onChange={(e) =>
              onUpload('loginHeroImageUrl', e.target.files?.[0] || null)
            }
          />
          <div>
            <label className="label">URL image</label>
            <input
              className="input"
              placeholder="https://… ou /branding/…"
              value={
                form.loginHeroImageUrl &&
                !form.loginHeroImageUrl.startsWith('data:')
                  ? form.loginHeroImageUrl
                  : ''
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  loginHeroImageUrl: e.target.value || null,
                })
              }
            />
          </div>
        </div>

        {err && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {err}
          </p>
        )}
        {msg && (
          <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <a
            className="btn-ghost border border-[var(--border)]"
            href="/login"
            target="_blank"
            rel="noreferrer"
          >
            Prévisualiser la connexion
          </a>
        </div>
      </form>
    </div>
  );
}
