'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { setToken } from '@/lib/api';

const LINKS = [
  {
    href: '/conducteur/plus/conges',
    title: 'Congés & absences',
    desc: 'Soldes et demandes',
    icon: '🏖',
  },
  {
    href: '/conducteur/plus/documents',
    title: 'Documents d’exploitation',
    desc: 'Billets, feuilles de route',
    icon: '📄',
  },
  {
    href: '/conducteur/plus/profil',
    title: 'Informations personnelles',
    desc: 'Coordonnées, permis, FCO',
    icon: '👤',
  },
  {
    href: '/conducteur/plus/incident',
    title: 'Signaler un incident',
    desc: 'Retard, panne, événement',
    icon: '⚠',
  },
  {
    href: '/conducteur/messages',
    title: 'Contacter l’exploitation',
    desc: 'Messagerie',
    icon: '✉',
  },
];

export default function DriverPlusPage() {
  const { me, logout, refresh } = useAuth();

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="drv-red-head px-4 pb-8 pt-4">
        <h1 className="text-2xl font-bold text-white">Plus</h1>
        <p className="mt-1 text-sm text-white/85">{me?.displayName}</p>
        <p className="text-xs text-white/70">{me?.email}</p>
      </div>

      <div className="-mt-4 space-y-2 px-4 pb-8">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="drv-card flex items-center gap-3 p-4"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-lg">
              {l.icon}
            </span>
            <span className="flex-1">
              <span className="block font-bold">{l.title}</span>
              <span className="block text-xs text-[var(--drv-muted)]">
                {l.desc}
              </span>
            </span>
            <span className="text-gray-300">›</span>
          </Link>
        ))}

        <button
          type="button"
          className="drv-card mt-4 w-full p-4 text-left font-bold text-rose-600"
          onClick={async () => {
            await logout();
            setToken(null);
            await refresh();
          }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}
