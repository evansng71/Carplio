import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true as const,
    ...rest,
  };
}

export function IconGauge(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      <path d="M12 12l3.5-3.5" />
    </svg>
  );
}
export function IconUsers(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-2.6 2.5-4.5 6-4.5s6 1.9 6 4.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M21 19c0-2-1.7-3.4-4-3.7" />
    </svg>
  );
}
export function IconFile(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
export function IconClipboard(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5h6V6a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 12h6M9 16h4" />
    </svg>
  );
}
export function IconRoute(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 7.5c3 1 5 3.5 5 7.5M15.8 16.5c-3-1-5-3.5-5-7.5" />
    </svg>
  );
}
export function IconCalendar(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
export function IconRepeat(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 12a7 7 0 0 1 7-7h9" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 12a7 7 0 0 1-7 7H4" />
    </svg>
  );
}
export function IconLink(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
export function IconBan(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 6.5l11 11" />
    </svg>
  );
}
export function IconSteering(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 5v4.5M7.2 16.2l3-2.2M16.8 16.2l-3-2.2" />
    </svg>
  );
}
export function IconId(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2.2" />
      <path d="M14 10h4M14 14h3" />
    </svg>
  );
}
export function IconBus(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M4 11h16M8 17v2M16 17v2M7 14h.01M17 14h.01" />
    </svg>
  );
}
export function IconMap(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 4l6 2 5-2v16l-5 2-6-2-5 2V6z" />
      <path d="M9 4v16M15 6v16" />
    </svg>
  );
}
export function IconInvoice(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 3h10v18l-2-1.2L13 21l-2-1.2L9 21l-2-1.2z" />
      <path d="M10 8h4M10 12h4M10 16h2" />
    </svg>
  );
}
export function IconWallet(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 8h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 8V6a2 2 0 0 1 2-2h12v4M18 14h.01" />
    </svg>
  );
}
export function IconWrench(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14.5 6.5a4 4 0 0 0-5.6 5.6L4 17v3h3l4.9-4.9a4 4 0 0 0 5.6-5.6L15 12z" />
    </svg>
  );
}
export function IconShield(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
      <path d="M9.5 12.5l1.8 1.8 3.7-3.8" />
    </svg>
  );
}
export function IconChart(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </svg>
  );
}
export function IconPortal(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 15h18M8 19h8" />
    </svg>
  );
}
export function IconBroadcast(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
export function IconSettings(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 7l1.7 1M17.4 16l1.7 1M4.9 17l1.7-1M17.4 8l1.7-1M3 12h2M19 12h2" />
    </svg>
  );
}
export function IconLock(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
export function IconAudit(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 4h8v3H8zM6 7h12v13H6z" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}
export function IconAdmin(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7z" />
      <circle cx="12" cy="11" r="2.2" />
      <path d="M8.5 16c.8-1.2 2-1.9 3.5-1.9s2.7.7 3.5 1.9" />
    </svg>
  );
}
export function IconSearch(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}
export function IconLogout(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
      <path d="M3 12h11M10 8l4 4-4 4" />
    </svg>
  );
}
export function IconPlus(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function IconAlert(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 4 3 19h18z" />
      <path d="M12 10v4M12 16.5h.01" />
    </svg>
  );
}
export function IconCheck(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
export function IconChevron(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
export function IconBuilding(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M4 21h16M10 8h.01M10 12h.01M10 16h.01M14 8h.01M14 12h.01M14 16h.01" />
    </svg>
  );
}

export type Tone =
  | 'blue'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'emerald'
  | 'slate'
  | 'cyan'
  | 'orange';

export const TONE_CLASS: Record<
  Tone,
  { icon: string; soft: string; ring: string; text: string }
> = {
  blue: {
    icon: 'text-[#1B6CA8]',
    soft: 'bg-[#1B6CA8]/12',
    ring: 'ring-[#1B6CA8]/25',
    text: 'text-[#1B6CA8]',
  },
  teal: {
    icon: 'text-[#0F766E]',
    soft: 'bg-[#0F766E]/12',
    ring: 'ring-[#0F766E]/25',
    text: 'text-[#0F766E]',
  },
  amber: {
    icon: 'text-[#C47A1A]',
    soft: 'bg-[#C47A1A]/12',
    ring: 'ring-[#C47A1A]/25',
    text: 'text-[#C47A1A]',
  },
  rose: {
    icon: 'text-[#B42318]',
    soft: 'bg-[#B42318]/12',
    ring: 'ring-[#B42318]/25',
    text: 'text-[#B42318]',
  },
  violet: {
    icon: 'text-[#6D28D9]',
    soft: 'bg-[#6D28D9]/12',
    ring: 'ring-[#6D28D9]/25',
    text: 'text-[#6D28D9]',
  },
  emerald: {
    icon: 'text-[#1F7A4D]',
    soft: 'bg-[#1F7A4D]/12',
    ring: 'ring-[#1F7A4D]/25',
    text: 'text-[#1F7A4D]',
  },
  slate: {
    icon: 'text-[#475569]',
    soft: 'bg-[#475569]/12',
    ring: 'ring-[#475569]/25',
    text: 'text-[#475569]',
  },
  cyan: {
    icon: 'text-[#0891B2]',
    soft: 'bg-[#0891B2]/12',
    ring: 'ring-[#0891B2]/25',
    text: 'text-[#0891B2]',
  },
  orange: {
    icon: 'text-[#EA580C]',
    soft: 'bg-[#EA580C]/12',
    ring: 'ring-[#EA580C]/25',
    text: 'text-[#EA580C]',
  },
};

export function IconTile({
  tone = 'blue',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.soft} ${t.icon} ${className}`}
    >
      {children}
    </span>
  );
}
