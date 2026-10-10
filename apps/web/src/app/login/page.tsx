'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { BrandMark } from '@/components/BrandMark';
import { Branding, FALLBACK_BRANDING, fetchBranding } from '@/lib/branding';

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
] as const;

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconBus() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M4 11h16M8 17v2M16 17v2M7 14h.01M17 14h.01" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19c0-2-1.8-3.5-4-3.8" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c0-3.2 2.8-5.5 7-5.5s7 2.3 7 5.5" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 3l18 18M10.5 10.6a2.5 2.5 0 0 0 3 3M9.4 5.4A10 10 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.2 2.3-2.4 3.5M6.2 6.3C4.5 7.6 3.3 9.3 2 12c1 2.5 5 7 10 7 1.4 0 2.7-.3 3.9-.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const FEATURES = [
  { label: 'Planification des services', Icon: IconCalendar },
  { label: 'Suivi en temps réel de la flotte', Icon: IconBus },
  { label: 'Gestion des conducteurs', Icon: IconUsers },
  { label: 'Optimisation de l’exploitation', Icon: IconChart },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [branding, setBranding] = useState<Branding>(FALLBACK_BRANDING);
  const [email, setEmail] = useState('admin@horizon-demo.fr');
  const [password, setPassword] = useState('Demo-Autocar-OS-2026!');
  const [mfaCode, setMfaCode] = useState('');
  const [needMfa, setNeedMfa] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<(typeof LANGS)[number]['code']>('fr');
  const [langOpen, setLangOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchBranding().then(setBranding);
    const saved = localStorage.getItem('remember_login');
    if (saved === '0') setRemember(false);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      localStorage.setItem('remember_login', remember ? '1' : '0');
      await login(email, password, mfaCode || undefined);
      router.push('/app');
    } catch (err) {
      const e = err as Error & { mfaRequired?: boolean };
      if (e.mfaRequired) {
        setNeedMfa(true);
        setError('Saisissez le code MFA');
      } else {
        setError(e.message || 'Échec connexion');
      }
    } finally {
      setBusy(false);
    }
  }

  const headline = branding.loginHeadline;
  const accentPhrase = 'en toute sérénité';
  const accentIdx = headline.toLowerCase().indexOf(accentPhrase);
  const before =
    accentIdx >= 0 ? headline.slice(0, accentIdx).trimEnd() : headline;
  const accent =
    accentIdx >= 0
      ? headline.slice(accentIdx, accentIdx + accentPhrase.length)
      : null;
  const after =
    accentIdx >= 0
      ? headline.slice(accentIdx + accentPhrase.length).trim()
      : '';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <aside className="relative hidden h-full w-[55%] shrink-0 overflow-hidden md:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.loginHeroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B1F33]/60 via-[#0B1F33]/30 to-[#1B6CA8]/40" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-6 overflow-y-auto p-8 text-white xl:p-12">
            <BrandMark
              logoUrl={branding.logoUrl}
              brandName={branding.brandName}
              tagline={branding.brandTagline}
              inverted
              size="md"
            />

            <div className="max-w-xl">
              <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
                {before}{' '}
                {accent && <span className="text-[#7EC8F5]">{accent}</span>}
                {after ? ` ${after}` : ''}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85 xl:text-base">
                {branding.loginSubheadline}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {FEATURES.map(({ label, Icon }) => (
                  <div key={label} className="flex flex-col gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white backdrop-blur">
                      <Icon />
                    </div>
                    <span className="text-xs font-medium leading-snug text-white/90">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-white/60">
              {branding.isDemo ? 'Environnement DEMO' : branding.companyName}
            </div>
          </div>
        </aside>

        <section className="relative flex h-full min-h-0 w-full flex-col overflow-y-auto md:w-[45%]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,_#1B6CA81f,_transparent_70%)]" />

          <div className="relative flex shrink-0 justify-end px-6 pt-5 sm:px-10">
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-night shadow-sm"
                onClick={() => setLangOpen((v) => !v)}
                aria-expanded={langOpen}
              >
                <IconGlobe />
                {LANGS.find((l) => l.code === lang)?.label}
                <span className="text-[var(--muted)]">▾</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-action/5 ${
                        lang === l.code
                          ? 'font-semibold text-action'
                          : 'text-night'
                      }`}
                      onClick={() => {
                        setLang(l.code);
                        setLangOpen(false);
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 py-6 sm:px-10">
            <div className="mb-6 flex flex-col items-center text-center">
              <BrandMark
                logoUrl={branding.logoUrl}
                brandName={branding.brandName}
                showWordmark={false}
                size="lg"
              />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-night">
                Bienvenue
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Connectez-vous à votre espace d’exploitation.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-night">
                  Identifiant
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    <IconUser />
                  </span>
                  <input
                    className="input rounded-xl py-2.5 pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="Votre identifiant"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-night">
                  Mot de passe
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    <IconLock />
                  </span>
                  <input
                    className="input rounded-xl py-2.5 pl-10 pr-10"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-night"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    <IconEye off={showPassword} />
                  </button>
                </div>
              </div>

              {needMfa && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-night">
                    Code MFA
                  </label>
                  <input
                    className="input rounded-xl py-2.5"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="6 chiffres"
                    autoComplete="one-time-code"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-night">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--action)]"
                  />
                  Se souvenir de moi
                </label>
                <Link
                  href="/login/forgot"
                  className="text-sm font-medium text-action hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              {error && (
                <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                className="btn-primary w-full rounded-xl py-3 text-base"
                disabled={busy}
              >
                {busy ? 'Connexion…' : 'Se connecter'}
                {!busy && <span aria-hidden>→</span>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              <Link
                className="font-medium text-action hover:underline"
                href="/conducteur"
              >
                Portail conducteur
              </Link>
              {' · '}
              <Link
                className="font-medium text-action hover:underline"
                href="/client"
              >
                Portail client
              </Link>
            </p>
          </div>
        </section>
      </div>

      <footer className="shrink-0 border-t border-[var(--border)] bg-white px-4 py-2 text-center text-[11px] tracking-wide text-[var(--muted)]">
        © 2026 Carpilato
      </footer>
    </div>
  );
}
