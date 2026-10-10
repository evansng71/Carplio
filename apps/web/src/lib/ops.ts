export const MISSION_STATUS: Record<string, string> = {
  to_plan: 'À planifier',
  planned: 'Planifiée',
  published: 'Publiée',
  in_progress: 'En cours',
  done: 'Terminée',
  ops_return_review: 'Retour billet',
  to_invoice: 'À facturer',
  cancelled: 'Annulée',
};

export const VEHICLE_STATUS: Record<string, string> = {
  available: 'Disponible',
  in_service: 'En service',
  maintenance: 'Maintenance',
  unavailable: 'Indisponible',
};

export const ENERGY_TYPES = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Électrique' },
  { value: 'hybrid', label: 'Hybride' },
  { value: 'gas', label: 'Gaz / GNV' },
];

export function missionStatusTone(status: string) {
  if (status === 'to_plan') return 'bg-amber-100 text-amber-900';
  if (status === 'planned') return 'bg-sky-100 text-sky-800';
  if (status === 'published' || status === 'in_progress')
    return 'bg-emerald-100 text-emerald-800';
  if (status === 'done' || status === 'to_invoice')
    return 'bg-slate-100 text-slate-700';
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function daysLeft(iso?: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
