'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  IconBus,
  IconClipboard,
  IconFile,
  IconInvoice,
  IconMail,
  IconPortal,
  IconRoute,
  IconUsers,
} from '@/components/Icons';
import { badgeClass, dt } from './lib';

type Home = {
  customer: { name: string; tradeName?: string | null; reference?: string | null };
  counts: {
    quotesOpen: number;
    tripsUpcoming: number;
    invoicesOpen: number;
    invoicesOverdue: number;
    requestsOpen: number;
    messagesOpen: number;
    docsCount: number;
  };
  nextTrip?: {
    id: string;
    number: string;
    title: string;
    startsAt: string;
    origin?: string | null;
    destination?: string | null;
    passengers: number;
  } | null;
};

export default function ClientHomePage() {
  const [data, setData] = useState<Home | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Home>('/client-portal/me')
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err)
    return (
      <p className="text-sm text-rose-600">
        {err.includes('Espace client')
          ? 'Ce compte n’est pas lié à un client. Utilisez client@villeurbanne-demo.fr'
          : err}
      </p>
    );
  if (!data)
    return <p className="text-sm text-[var(--cli-muted)]">Chargement…</p>;

  const c = data.counts;
  const kpis = [
    {
      label: 'Voyages à venir',
      value: c.tripsUpcoming,
      href: '/client/voyages',
      tone: 'cyan',
      Icon: IconRoute,
    },
    {
      label: 'Devis à traiter',
      value: c.quotesOpen,
      href: '/client/devis',
      tone: 'amber',
      Icon: IconFile,
    },
    {
      label: 'Factures ouvertes',
      value: c.invoicesOpen,
      href: '/client/factures',
      tone: 'teal',
      Icon: IconInvoice,
    },
    {
      label: 'Messages',
      value: c.messagesOpen,
      href: '/client/messages',
      tone: 'sky',
      Icon: IconMail,
    },
  ] as const;

  const spots = [
    {
      href: '/client/demande',
      title: 'Demander un devis',
      desc: 'Occasionnel, scolaire, événement… réponse sous 48h.',
      tone: 'cyan',
      Icon: IconClipboard,
    },
    {
      href: '/client/documents',
      title: `Documents (${c.docsCount})`,
      desc: 'BC, assurances et pièces à transmettre.',
      tone: 'teal',
      Icon: IconPortal,
    },
    {
      href: '/client/factures',
      title: 'Facturation',
      desc:
        c.invoicesOverdue > 0
          ? `${c.invoicesOverdue} facture(s) en retard à consulter.`
          : 'Échéances, paiements et avoirs.',
      tone: c.invoicesOverdue > 0 ? 'rose' : 'emerald',
      Icon: IconInvoice,
    },
    {
      href: '/client/profil',
      title: 'Profil & lieux',
      desc: 'Coordonnées, contacts et destinations favorites.',
      tone: 'navy',
      Icon: IconUsers,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="cli-kicker">{data.customer.reference || 'Client'}</p>
          <h1 className="cli-h1 mt-1">
            {data.customer.tradeName || data.customer.name}
          </h1>
          <p className="cli-sub">
            Vue d’ensemble de vos prestations, devis et factures.
          </p>
        </div>
        <Link href="/client/voyages" className="cli-btn cli-btn-secondary">
          <IconBus size={16} />
          Voir le planning
        </Link>
      </div>

      <div className="cli-kpi">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className={`cli-card cli-card-interactive cli-kpi-card cli-tone-${k.tone}`}
          >
            <span className={`cli-ico cli-ico-${k.tone}`}>
              <k.Icon size={18} />
            </span>
            <div className="cli-kpi-value">{k.value}</div>
            <div className="cli-kpi-label">{k.label}</div>
          </Link>
        ))}
      </div>

      {data.nextTrip && (
        <section className="cli-card cli-hero-trip">
          <div className="cli-hero-trip-main">
            <div className="flex items-center gap-2">
              <span className="cli-ico cli-ico-cyan">
                <IconRoute size={18} />
              </span>
              <span className="cli-kicker">Prochain voyage</span>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              {data.nextTrip.title}
            </h2>
            <p className="mt-1 text-[var(--cli-muted)]">
              {data.nextTrip.origin} → {data.nextTrip.destination}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-cyan-50 px-3 py-1 font-semibold text-cyan-800">
                {dt(data.nextTrip.startsAt)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                {data.nextTrip.passengers} voyageurs
              </span>
            </div>
            <Link href="/client/voyages" className="cli-btn cli-btn-primary mt-5">
              Détail des voyages
            </Link>
          </div>
          <div className="cli-hero-trip-side">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-sky-200/80">
              Référence
            </div>
            <div className="text-2xl font-bold">{data.nextTrip.number}</div>
            <p className="text-sm text-white/70">
              Votre prestation est confirmée. Consultez les horaires et le
              détail dans Voyages.
            </p>
            <span className={badgeClass('info')}>Confirmé</span>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold">Accès rapides</h2>
          <Link
            href="/client/plus"
            className="text-sm font-semibold text-[var(--cli-accent-deep)]"
          >
            Tous les services →
          </Link>
        </div>
        <div className="cli-spot-grid">
          {spots.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="cli-card cli-card-interactive cli-spot"
            >
              <span className={`cli-ico cli-ico-${s.tone}`}>
                <s.Icon size={18} />
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
