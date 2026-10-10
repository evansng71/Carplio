'use client';

import '../client.css';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ClientNav } from './ClientNav';

type CompanyBrand = {
  name: string;
  tradeName?: string | null;
  logoUrl?: string | null;
};

export function ClientShell({ children }: { children: React.ReactNode }) {
  const { me, loading, login, logout } = useAuth();
  const path = usePathname();
  const [email, setEmail] = useState('client@villeurbanne-demo.fr');
  const [password, setPassword] = useState('Demo-Autocar-OS-2026!');
  const [err, setErr] = useState('');
  const [company, setCompany] = useState<CompanyBrand>({
    name: 'Espace client',
    tradeName: null,
    logoUrl: null,
  });
  const publicPage = path.startsWith('/client/publique');

  useEffect(() => {
    // Branding public (logo société transporteur) — aussi pour login / publique
    api<{
      companyName?: string;
      tradeName?: string | null;
      logoUrl?: string | null;
    }>('/org/branding')
      .then((b) => {
        setCompany({
          name: b.companyName || 'Espace client',
          tradeName: b.tradeName,
          logoUrl: b.logoUrl,
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me) return;
    api<{ company?: CompanyBrand }>('/client-portal/me')
      .then((d) => {
        if (!d.company) return;
        setCompany({
          name: d.company.name || company.name,
          tradeName: d.company.tradeName,
          logoUrl: d.company.logoUrl ?? company.logoUrl,
        });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const displayCompany = company.tradeName || company.name;
  const logoSrc = company.logoUrl || null;

  if (loading) {
    return (
      <div className="cli flex min-h-dvh items-center justify-center text-sm text-[var(--cli-muted)]">
        Chargement de votre espace…
      </div>
    );
  }

  if (!me && publicPage) {
    return <div className="cli">{children}</div>;
  }

  if (!me) {
    return (
      <div className="cli">
        <div className="cli-login-wrap">
          <section className="cli-login-panel">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={displayCompany}
                className="mb-8 h-16 w-auto max-w-[240px] object-contain"
              />
            ) : (
              <div className="mb-8 text-2xl font-bold tracking-tight">
                {displayCompany}
              </div>
            )}
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200/80">
              Espace client
            </p>
            <h1
              className="mt-3 text-4xl font-bold tracking-tight"
              style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              Pilotez vos transports
              <br />
              en toute clarté
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Devis, voyages confirmés, factures et documents — un portail
              pensé pour les organisateurs et collectivités.
            </p>
            <ul className="mt-8 space-y-2 text-sm text-sky-100/90">
              <li>· Suivi des prestations à venir</li>
              <li>· Validation des devis en ligne</li>
              <li>· Facturation et pièces partagées</li>
            </ul>
          </section>
          <section className="cli-login-form-wrap">
            <form
              className="cli-login-form cli-card space-y-3 p-7"
              onSubmit={async (e: FormEvent) => {
                e.preventDefault();
                setErr('');
                try {
                  await login(email, password);
                } catch (ex) {
                  setErr(ex instanceof Error ? ex.message : 'Échec connexion');
                }
              }}
            >
              <h2 className="text-xl font-bold">Connexion</h2>
              <p className="text-sm text-[var(--cli-muted)]">
                Accédez à votre dossier client.
              </p>
              <label className="block text-xs font-semibold text-[var(--cli-muted)]">
                E-mail
                <input
                  className="cli-input mt-1"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--cli-muted)]">
                Mot de passe
                <input
                  className="cli-input mt-1"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {err && <p className="text-sm text-rose-600">{err}</p>}
              <button type="submit" className="cli-btn cli-btn-primary w-full">
                Se connecter
              </button>
              <Link
                href="/client/publique"
                className="cli-btn cli-btn-ghost w-full text-center"
              >
                Demande de devis sans compte
              </Link>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="cli">
      <div className="cli-desktop">
        <aside className="cli-aside">
          <div className="cli-aside-brand">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={displayCompany} />
            ) : (
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">
                {displayCompany}
              </div>
            )}
            <div className="cli-aside-company">{displayCompany}</div>
          </div>
          <ClientNav />
          <div className="cli-aside-foot">
            <div className="mb-2 truncate px-1 text-xs text-white/55">
              {me.displayName}
            </div>
            <button
              type="button"
              className="cli-btn cli-btn-ghost w-full border-white/15 text-xs text-white/85 hover:bg-white/10"
              onClick={() => logout()}
            >
              Déconnexion
            </button>
          </div>
        </aside>
        <div className="cli-content">
          <header className="cli-topbar">
            <div>
              <div className="cli-kicker">Portail client</div>
              <div className="text-sm font-semibold text-[var(--cli-ink)]">
                Bienvenue, {me.displayName}
              </div>
            </div>
            <Link href="/client/demande" className="cli-btn cli-btn-primary">
              Nouvelle demande
            </Link>
          </header>
          <main className="cli-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
