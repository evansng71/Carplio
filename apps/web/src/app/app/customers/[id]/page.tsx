'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api(`/customers/${id}`).then(setC);
  }, [id]);
  if (!c) return <p>Chargement…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{String(c.name)}</h1>
      <div className="card p-4 text-sm">
        <div>Type : {String(c.type)}</div>
        <div>Email : {String(c.email || '—')}</div>
        <div>Préférences véhicule : {String(c.preferredVehicleNotes || '—')}</div>
        <div>Préférences conducteur : {String(c.preferredDriverNotes || '—')}</div>
      </div>
    </div>
  );
}
