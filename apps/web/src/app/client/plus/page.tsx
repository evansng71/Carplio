'use client';

import Link from 'next/link';
import {
  IconClipboard,
  IconFile,
  IconMail,
  IconPortal,
  IconUsers,
} from '@/components/Icons';

const LINKS = [
  {
    href: '/client/demande',
    title: 'Nouvelle demande de devis',
    desc: 'Créer une demande suivie dans votre dossier',
    tone: 'cyan',
    Icon: IconClipboard,
  },
  {
    href: '/client/documents',
    title: 'Documents',
    desc: 'Déposer BC, listes passagers, assurances',
    tone: 'teal',
    Icon: IconPortal,
  },
  {
    href: '/client/messages',
    title: 'Messagerie commerciale',
    desc: 'Contacter votre interlocuteur',
    tone: 'sky',
    Icon: IconMail,
  },
  {
    href: '/client/profil',
    title: 'Profil & lieux',
    desc: 'Coordonnées, contacts, destinations',
    tone: 'navy',
    Icon: IconUsers,
  },
  {
    href: '/client/publique',
    title: 'Formulaire public',
    desc: 'Lien partageable pour une demande sans compte',
    tone: 'amber',
    Icon: IconFile,
  },
] as const;

export default function ClientPlusPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="cli-kicker">Services</p>
        <h1 className="cli-h1 mt-1">Tout votre espace</h1>
        <p className="cli-sub">Raccourcis vers les outils du portail client.</p>
      </div>
      <div className="cli-spot-grid">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="cli-card cli-card-interactive cli-spot"
          >
            <span className={`cli-ico cli-ico-${l.tone}`}>
              <l.Icon size={18} />
            </span>
            <div>
              <h3>{l.title}</h3>
              <p>{l.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
