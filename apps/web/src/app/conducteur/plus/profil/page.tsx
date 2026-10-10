'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Profile = {
  user: { email: string; displayName: string };
  employee: {
    matricule: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    contractType?: string | null;
    hiredAt?: string | null;
    city?: string | null;
    addressLine1?: string | null;
    postalCode?: string | null;
    depot?: { name: string } | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
  };
  driver: {
    licenseNumber?: string | null;
    licenseCategories?: string | null;
    licenseExpiresAt?: string | null;
    fcoExpiresAt?: string | null;
    medicalExpiresAt?: string | null;
    cardExpiresAt?: string | null;
    qualifications?: string | null;
  };
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-50 py-2 text-sm">
      <span className="text-[var(--drv-muted)]">{label}</span>
      <span className="text-right font-semibold">{value || '—'}</span>
    </div>
  );
}

function d(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

export default function DriverProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Profile>('/portal/me/profile')
      .then(setP)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="bg-[var(--drv-bg)] min-h-dvh">
      <div className="drv-red-head px-4 pb-8 pt-3">
        <Link href="/conducteur/plus" className="text-white/90">
          ← Plus
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {p ? `${p.employee.lastName} ${p.employee.firstName}` : 'Profil'}
        </h1>
        <p className="text-sm text-white/80">
          {p?.employee.jobTitle || 'Conducteur'} · {p?.employee.matricule}
        </p>
      </div>

      <div className="-mt-4 space-y-3 px-4 pb-8">
        {err && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <section className="drv-card p-4">
          <h2 className="mb-1 text-sm font-bold">Coordonnées</h2>
          <Row label="E-mail" value={p?.employee.email || p?.user.email} />
          <Row label="Téléphone" value={p?.employee.phone} />
          <Row
            label="Adresse"
            value={
              [p?.employee.addressLine1, p?.employee.postalCode, p?.employee.city]
                .filter(Boolean)
                .join(', ') || null
            }
          />
          <Row label="Dépôt" value={p?.employee.depot?.name} />
          <Row label="Contrat" value={p?.employee.contractType} />
          <Row label="Embauche" value={d(p?.employee.hiredAt)} />
        </section>

        <section className="drv-card p-4">
          <h2 className="mb-1 text-sm font-bold">Urgence</h2>
          <Row label="Contact" value={p?.employee.emergencyContact} />
          <Row label="Téléphone" value={p?.employee.emergencyPhone} />
        </section>

        <section className="drv-card p-4">
          <h2 className="mb-1 text-sm font-bold">Permis & conformité</h2>
          <Row label="N° permis" value={p?.driver.licenseNumber} />
          <Row label="Catégories" value={p?.driver.licenseCategories} />
          <Row label="Permis expire" value={d(p?.driver.licenseExpiresAt)} />
          <Row label="FCO expire" value={d(p?.driver.fcoExpiresAt)} />
          <Row label="Médical expire" value={d(p?.driver.medicalExpiresAt)} />
          <Row label="Carte chrono" value={d(p?.driver.cardExpiresAt)} />
          <Row label="Qualifications" value={p?.driver.qualifications} />
        </section>
      </div>
    </div>
  );
}
