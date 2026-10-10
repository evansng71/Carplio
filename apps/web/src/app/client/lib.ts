export function money(n?: number | null) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function dt(iso?: string | null, withTime = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

export const QUOTE_STATUS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'À valider',
  accepted: 'Accepté',
  refused: 'Refusé',
  planning: 'En planning',
  invoicing: 'Facturation',
  trashed: 'Supprimé',
};

export const INVOICE_STATUS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Émise',
  partial: 'Partielle',
  overdue: 'En retard',
  paid: 'Payée',
  cancelled: 'Annulée',
  void: 'Annulée',
};

export const TRIP_STATUS: Record<string, string> = {
  to_plan: 'À planifier',
  planned: 'Planifié',
  published: 'Confirmé',
  in_progress: 'En cours',
  done: 'Terminé',
  ops_return_review: 'Clôture',
  to_invoice: 'À facturer',
  cancelled: 'Annulé',
};

export function badgeClass(kind: 'ok' | 'warn' | 'info' | 'muted') {
  return `cli-badge cli-badge-${kind}`;
}
