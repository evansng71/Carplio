'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: Array<{
  href: string;
  label: string;
  icon: () => React.ReactNode;
  exact?: boolean;
}> = [
  { href: '/conducteur', label: 'Accueil', icon: HomeIcon, exact: true },
  { href: '/conducteur/planning', label: 'Planning', icon: CalIcon },
  { href: '/conducteur/messages', label: 'Messages', icon: MailIcon },
  { href: '/conducteur/compteurs', label: 'Compteurs', icon: GaugeIcon },
  { href: '/conducteur/plus', label: 'Plus', icon: MoreIcon },
];

export function DriverNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav className="drv-nav">
      {ITEMS.map((item) => {
        const active = item.exact
          ? path === item.href
          : item.href === '/conducteur/planning'
            ? path.startsWith('/conducteur/planning') ||
              path.startsWith('/conducteur/jour')
            : path === item.href || path.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'active' : ''}
          >
            <Icon />
            {item.label === 'Messages' && unread > 0 && (
              <span className="drv-badge">{unread > 99 ? '99+' : unread}</span>
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 16a7 7 0 1 1 14 0" />
      <path d="M12 16 16 10" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}
