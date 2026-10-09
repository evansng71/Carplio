'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/app', label: 'Cockpit', perm: 'dashboard:widget:list' },
  { href: '/app/customers', label: 'Clients', perm: 'customers:customer:list' },
  { href: '/app/quotes', label: 'Devis', perm: 'quotes:quote:list' },
  { href: '/app/orders', label: 'Commandes', perm: 'orders:order:list' },
  { href: '/app/missions', label: 'Missions', perm: 'missions:mission:list' },
  { href: '/app/planning', label: 'Planning', perm: 'planning:assignment:list' },
  { href: '/app/rosters', label: 'Roulements', perm: 'services:service:list' },
  { href: '/app/dressing', label: 'Habillage HLP', perm: 'planning:assignment:list' },
  { href: '/app/unavailabilities', label: 'Indisponibilités', perm: 'planning:assignment:list' },
  { href: '/app/drivers', label: 'Conducteurs', perm: 'drivers:driver:list' },
  { href: '/app/employees', label: 'RH / Salariés', perm: 'hr:employee:list' },
  { href: '/app/vehicles', label: 'Véhicules', perm: 'fleet:vehicle:list' },
  { href: '/app/transport', label: 'Plan transport', perm: 'courses:course:list' },
  { href: '/app/billing', label: 'Facturation', perm: 'billing:invoice:list' },
  { href: '/app/prep-payroll', label: 'Prépaye', perm: 'hr:prepPayroll:list' },
  { href: '/app/workshop', label: 'Atelier', perm: 'fleet:workshop:list' },
  { href: '/app/quality', label: 'Qualité', perm: 'quality:incident:list' },
  { href: '/app/analytics', label: 'BI / Budgets', perm: 'dashboard:analytics:list' },
  { href: '/app/client-requests', label: 'Portail client', perm: 'quotes:quote:list' },
  { href: '/app/portal-ops', label: 'Portail ops', perm: 'portal:publication:publish' },
  { href: '/app/security', label: 'MFA / Sécurité', perm: 'users:account:manage' },
  { href: '/app/admin', label: 'Admin droits', perm: 'users:account:list' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  const items = useMemo(
    () => NAV.filter((n) => can(n.perm) || me?.isSuperAdmin),
    [can, me],
  );

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Authentification…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 flex h-screen flex-col border-r border-[var(--border)] bg-night text-cream transition-all ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          {!collapsed && (
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-action-soft/90">
                AUTOCAR OS
              </div>
              <div className="text-sm font-semibold">Horizon DEMO</div>
            </div>
          )}
          <button
            className="rounded-md px-2 py-1 text-xs text-cream/70 hover:bg-white/10"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Replier"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 pb-4">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-white/15 font-semibold text-white'
                    : 'text-cream/75 hover:bg-white/8 hover:text-white'
                }`}
                title={item.label}
              >
                {!collapsed ? item.label : item.label.slice(0, 1)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs text-cream/70">
          {!collapsed && (
            <>
              <div className="font-semibold text-cream">{me.displayName}</div>
              <div className="truncate">{me.email}</div>
            </>
          )}
          <button
            className="mt-2 text-action-soft hover:underline"
            onClick={() => logout().then(() => router.push('/login'))}
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/90 px-6 py-3 backdrop-blur">
          <input
            className="input max-w-md"
            placeholder="Recherche globale (clients, missions…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim()) {
                router.push(`/app/customers?q=${encodeURIComponent(q.trim())}`);
              }
            }}
          />
          <div className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-action/10 px-2.5 py-1 font-semibold text-action">
              Société DEMO
            </span>
            <span className="rounded-full bg-night/5 px-2.5 py-1">Dépôt Lyon</span>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
