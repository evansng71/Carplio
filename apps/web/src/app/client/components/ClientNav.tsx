'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconBus,
  IconClipboard,
  IconFile,
  IconGauge,
  IconInvoice,
  IconMail,
  IconPortal,
  IconRoute,
  IconUsers,
} from '@/components/Icons';

const ITEMS = [
  { href: '/client', label: 'Accueil', exact: true, Icon: IconGauge },
  { href: '/client/voyages', label: 'Voyages', Icon: IconRoute },
  { href: '/client/devis', label: 'Devis', Icon: IconFile },
  { href: '/client/factures', label: 'Factures', Icon: IconInvoice },
  { href: '/client/demande', label: 'Demande', Icon: IconClipboard },
  { href: '/client/documents', label: 'Documents', Icon: IconPortal },
  { href: '/client/messages', label: 'Messages', Icon: IconMail },
  { href: '/client/profil', label: 'Profil', Icon: IconUsers },
  { href: '/client/plus', label: 'Services', Icon: IconBus },
] as const;

export function ClientNav() {
  const path = usePathname();
  return (
    <nav className="cli-aside-nav" aria-label="Navigation portail client">
      {ITEMS.map((item) => {
        const active = item.exact
          ? path === item.href
          : path === item.href || path.startsWith(`${item.href}/`);
        const Icon = item.Icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'active' : undefined}
          >
            <span className="cli-nav-ico">
              <Icon size={16} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
