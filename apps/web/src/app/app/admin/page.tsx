'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import {
  IconAdmin,
  IconAudit,
  IconChevron,
  IconLock,
  IconSettings,
  IconTile,
  IconUsers,
  IconId,
  IconFile,
  Tone,
} from '@/components/Icons';

const CARDS: Array<{
  href: string;
  title: string;
  desc: string;
  perm: string;
  tone: Tone;
  Icon: typeof IconSettings;
}> = [
  {
    href: '/app/admin/settings',
    title: 'Paramètres système',
    desc: 'Société, logos, image de connexion, identité visuelle.',
    perm: 'settings:company:manage',
    tone: 'teal',
    Icon: IconSettings,
  },
  {
    href: '/app/admin/templates',
    title: 'Modèles d’impression',
    desc: 'Composer devis, factures, planning et billets — reliés au bouton Imprimer.',
    perm: 'documents:template:list',
    tone: 'amber',
    Icon: IconFile,
  },
  {
    href: '/app/admin/users',
    title: 'Utilisateurs',
    desc: 'Comptes, invitations, groupes, suspension et sessions.',
    perm: 'users:account:list',
    tone: 'violet',
    Icon: IconUsers,
  },
  {
    href: '/app/admin/groups',
    title: 'Groupes & droits',
    desc: 'Rôles, matrice de permissions, création de groupes.',
    perm: 'groups:group:list',
    tone: 'amber',
    Icon: IconId,
  },
  {
    href: '/app/admin/audits',
    title: 'Journal d’audit',
    desc: 'Historrique des actions sensibles sur les accès.',
    perm: 'audits:event:list',
    tone: 'slate',
    Icon: IconAudit,
  },
  {
    href: '/app/security',
    title: 'MFA / Sécurité',
    desc: 'Authentification à deux facteurs sur votre compte.',
    perm: 'users:account:manage',
    tone: 'rose',
    Icon: IconLock,
  },
];

export default function AdminHubPage() {
  const { can, me } = useAuth();
  const cards = CARDS.filter((c) => can(c.perm) || me?.isSuperAdmin);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <IconTile tone="blue" className="h-12 w-12">
          <IconAdmin size={22} />
        </IconTile>
        <div>
          <p className="page-kicker">Administration</p>
          <h1 className="mt-1 text-2xl font-bold">Centre d’administration</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Paramètres système, accès utilisateurs et sécurité Carpilato.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card-interactive block p-5">
            <div className="flex items-start gap-3">
              <IconTile tone={c.tone}>
                <c.Icon size={18} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-night">{c.title}</h2>
                  <IconChevron size={16} className="text-[var(--muted)]" />
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
