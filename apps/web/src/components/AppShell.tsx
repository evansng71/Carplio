'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ComponentType, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  IconAdmin,
  IconAudit,
  IconBroadcast,
  IconBus,
  IconCalendar,
  IconChart,
  IconClipboard,
  IconFile,
  IconGauge,
  IconId,
  IconInvoice,
  IconLink,
  IconLock,
  IconLogout,
  IconMap,
  IconBan,
  IconPortal,
  IconRepeat,
  IconRoute,
  IconSearch,
  IconSettings,
  IconShield,
  IconSteering,
  IconUsers,
  IconWallet,
  IconWrench,
  Tone,
  TONE_CLASS,
} from '@/components/Icons';

type NavItem = {
  href: string;
  label: string;
  perm: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: Tone;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: '/app', label: 'Cockpit', perm: 'dashboard:widget:list', icon: IconGauge, tone: 'blue' },
  { href: '/app/employees', label: 'RH / Salariés', perm: 'hr:employee:list', icon: IconId, tone: 'violet' },
  { href: '/app/transport', label: 'Plan transport', perm: 'courses:course:list', icon: IconMap, tone: 'cyan' },
  { href: '/app/prep-payroll', label: 'Prépaye', perm: 'hr:prepPayroll:list', icon: IconWallet, tone: 'emerald' },
  { href: '/app/workshop', label: 'Atelier', perm: 'fleet:workshop:list', icon: IconWrench, tone: 'orange' },
  { href: '/app/quality', label: 'Qualité', perm: 'quality:incident:list', icon: IconShield, tone: 'rose' },
  { href: '/app/analytics', label: 'BI / Budgets', perm: 'dashboard:analytics:list', icon: IconChart, tone: 'blue' },
  { href: '/app/client-requests', label: 'Portail client', perm: 'quotes:quote:list', icon: IconPortal, tone: 'teal' },
  { href: '/app/portal-ops', label: 'Portail ops', perm: 'portal:publication:publish', icon: IconBroadcast, tone: 'violet' },
];

const COMMERCIAL_NAV: NavItem[] = [
  { href: '/app/customers', label: 'Clients', perm: 'customers:customer:list', icon: IconUsers, tone: 'teal' },
  { href: '/app/quotes', label: 'Devis', perm: 'quotes:quote:list', icon: IconFile, tone: 'amber' },
  { href: '/app/orders', label: 'Commandes', perm: 'orders:order:list', icon: IconClipboard, tone: 'orange' },
  { href: '/app/billing', label: 'Factures', perm: 'billing:invoice:list', icon: IconInvoice, tone: 'amber' },
];

const OPS_NAV: NavItem[] = [
  { href: '/app/ops', label: 'Cockpit exploitation', perm: 'planning:assignment:list', icon: IconGauge, tone: 'violet' },
  { href: '/app/missions', label: 'Missions', perm: 'missions:mission:list', icon: IconRoute, tone: 'violet' },
  { href: '/app/planning', label: 'Planning', perm: 'planning:assignment:list', icon: IconCalendar, tone: 'blue' },
  { href: '/app/vehicles', label: 'Véhicules', perm: 'fleet:vehicle:list', icon: IconBus, tone: 'teal' },
  { href: '/app/drivers', label: 'Conducteurs', perm: 'drivers:driver:list', icon: IconSteering, tone: 'emerald' },
  { href: '/app/unavailabilities', label: 'Indisponibilités', perm: 'planning:assignment:list', icon: IconBan, tone: 'rose' },
  { href: '/app/rosters', label: 'Roulements', perm: 'services:service:list', icon: IconRepeat, tone: 'cyan' },
  { href: '/app/dressing', label: 'Habillage HLP', perm: 'planning:assignment:list', icon: IconLink, tone: 'slate' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/app/admin', label: 'Vue d’ensemble', perm: 'users:account:list', icon: IconAdmin, tone: 'blue', exact: true },
  { href: '/app/admin/settings', label: 'Paramètres système', perm: 'settings:company:manage', icon: IconSettings, tone: 'teal' },
  { href: '/app/admin/templates', label: 'Modèles d’impression', perm: 'documents:template:list', icon: IconFile, tone: 'amber' },
  { href: '/app/admin/users', label: 'Utilisateurs', perm: 'users:account:list', icon: IconUsers, tone: 'violet' },
  { href: '/app/admin/groups', label: 'Groupes & droits', perm: 'groups:group:list', icon: IconId, tone: 'amber' },
  { href: '/app/admin/audits', label: 'Journal d’audit', perm: 'audits:event:list', icon: IconAudit, tone: 'slate' },
  { href: '/app/security', label: 'MFA / Sécurité', perm: 'users:account:manage', icon: IconLock, tone: 'rose' },
];

function navActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href === '/app') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isCommercialPath(pathname: string) {
  return (
    pathname.startsWith('/app/customers') ||
    pathname.startsWith('/app/quotes') ||
    pathname.startsWith('/app/orders') ||
    pathname.startsWith('/app/billing')
  );
}

function isOpsPath(pathname: string) {
  return (
    pathname.startsWith('/app/ops') ||
    pathname.startsWith('/app/missions') ||
    pathname.startsWith('/app/planning') ||
    pathname.startsWith('/app/vehicles') ||
    pathname.startsWith('/app/drivers') ||
    pathname.startsWith('/app/unavailabilities') ||
    pathname.startsWith('/app/rosters') ||
    pathname.startsWith('/app/dressing')
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState('');
  const adminOpenDefault =
    pathname.startsWith('/app/admin') || pathname.startsWith('/app/security');
  const commercialOpenDefault = isCommercialPath(pathname);
  const opsOpenDefault = isOpsPath(pathname);
  const [adminOpen, setAdminOpen] = useState(adminOpenDefault);
  const [commercialOpen, setCommercialOpen] = useState(commercialOpenDefault);
  const [opsOpen, setOpsOpen] = useState(opsOpenDefault);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  useEffect(() => {
    if (adminOpenDefault) setAdminOpen(true);
  }, [adminOpenDefault]);

  useEffect(() => {
    if (commercialOpenDefault) setCommercialOpen(true);
  }, [commercialOpenDefault]);

  useEffect(() => {
    if (opsOpenDefault) setOpsOpen(true);
  }, [opsOpenDefault]);

  const items = useMemo(
    () => NAV.filter((n) => can(n.perm) || me?.isSuperAdmin),
    [can, me],
  );
  const commercialItems = useMemo(
    () => COMMERCIAL_NAV.filter((n) => can(n.perm) || me?.isSuperAdmin),
    [can, me],
  );
  const opsItems = useMemo(
    () => OPS_NAV.filter((n) => can(n.perm) || me?.isSuperAdmin),
    [can, me],
  );
  const adminItems = useMemo(
    () => ADMIN_NAV.filter((n) => can(n.perm) || me?.isSuperAdmin),
    [can, me],
  );
  const showAdmin = adminItems.length > 0;
  const showCommercial = commercialItems.length > 0;
  const showOps = opsItems.length > 0;

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Authentification…
      </div>
    );
  }

  const renderNavLink = (item: NavItem) => {
    const active = navActive(pathname, item.href, item.exact);
    const Icon = item.icon;
    const tone = TONE_CLASS[item.tone];
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${
          active
            ? 'bg-white/15 font-semibold text-white'
            : 'text-cream/75 hover:bg-white/8 hover:text-white'
        }`}
        title={item.label}
      >
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-white/20 text-white' : `${tone.soft} ${tone.icon}`
          }`}
        >
          <Icon size={16} />
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const renderSection = (
    label: string,
    open: boolean,
    setOpen: (v: boolean | ((p: boolean) => boolean)) => void,
    openDefault: boolean,
    sectionItems: NavItem[],
    toneClass: string,
    icon: React.ReactNode,
    homeHref: string,
  ) => {
    if (!sectionItems.length) return null;
    if (collapsed) {
      return (
        <Link
          href={homeHref}
          className={`flex items-center justify-center rounded-xl px-2 py-2 ${
            openDefault ? 'bg-white/15' : 'hover:bg-white/8'
          }`}
          title={label}
        >
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
            {icon}
          </span>
        </Link>
      );
    }
    return (
      <div className="pt-2">
        <button
          type="button"
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${
            openDefault
              ? 'bg-white/10 font-semibold text-white'
              : 'text-cream/75 hover:bg-white/8 hover:text-white'
          }`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
            {icon}
          </span>
          <span className="flex-1 text-left">{label}</span>
          <span className="text-xs text-cream/60">{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div className="mt-0.5 mb-2 ml-3 space-y-0.5 border-l border-white/10 pl-2">
            {sectionItems.map(renderNavLink)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`flex h-full shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-[#0B1F33] via-[#0E2740] to-[#0A1A2B] text-cream transition-all ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between px-3 py-4">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-1">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-action/20 text-action-soft">
                <IconBus size={18} className="text-[#7EC8F5]" />
              </span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7EC8F5]">
                  Carpilato
                </div>
                <div className="text-sm font-semibold">Horizon DEMO</div>
              </div>
            </div>
          ) : (
            <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl bg-action/20">
              <IconBus size={18} className="text-[#7EC8F5]" />
            </span>
          )}
          <button
            className="rounded-lg px-2 py-1 text-xs text-cream/70 hover:bg-white/10"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Replier"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {items.slice(0, 1).map(renderNavLink)}

          {showCommercial &&
            renderSection(
              'Commercial',
              commercialOpen,
              setCommercialOpen,
              commercialOpenDefault,
              commercialItems,
              'bg-[#0F766E]/20 text-[#5EEAD4]',
              <IconClipboard size={16} />,
              '/app/customers',
            )}

          {showOps &&
            renderSection(
              'Exploitation',
              opsOpen,
              setOpsOpen,
              opsOpenDefault,
              opsItems,
              'bg-[#6D28D9]/20 text-[#C4B5FD]',
              <IconRoute size={16} />,
              '/app/ops',
            )}

          {items.slice(1).map(renderNavLink)}

          {showAdmin &&
            renderSection(
              'Administration',
              adminOpen,
              setAdminOpen,
              adminOpenDefault,
              adminItems,
              'bg-[#6D28D9]/20 text-[#C4B5FD]',
              <IconAdmin size={16} />,
              '/app/admin',
            )}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3 text-xs text-cream/70">
          {!collapsed && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                {me.displayName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-cream">
                  {me.displayName}
                </div>
                <div className="truncate">{me.email}</div>
              </div>
            </div>
          )}
          <button
            className="inline-flex items-center gap-1.5 text-[#7EC8F5] hover:underline"
            onClick={() => logout().then(() => router.push('/login'))}
          >
            <IconLogout size={14} />
            {!collapsed && 'Déconnexion'}
          </button>
          {!collapsed && (
            <div className="mt-3 border-t border-white/10 pt-2 text-[10px] tracking-wide text-cream/45">
              © 2026 Carpilato
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-white/80 px-6 py-3 backdrop-blur">
          <div className="relative max-w-md flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              <IconSearch size={16} />
            </span>
            <input
              className="input pl-9"
              placeholder="Recherche globale (clients, missions…)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q.trim()) {
                  router.push(
                    `/app/customers?q=${encodeURIComponent(q.trim())}`,
                  );
                }
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="badge-blue">Société DEMO</span>
            <span className="badge-teal">Dépôt Lyon</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
        <footer className="shrink-0 border-t border-[var(--border)] bg-white/70 px-6 py-2 text-center text-[11px] tracking-wide text-[var(--muted)]">
          © 2026 Carpilato
        </footer>
      </div>
    </div>
  );
}
