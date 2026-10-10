export const INVOICE_STATUS: Record<string, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  partial: 'Partiellement payée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

export const INVOICE_KIND: Record<string, string> = {
  standard: 'Standard',
  deposit: 'Acompte',
  interim: 'Situation / intermédiaire',
  final: 'Solde',
  supplementary: 'Complémentaire',
  credit_note: 'Avoir',
};

export const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Virement' },
  { value: 'check', label: 'Chèque' },
  { value: 'card', label: 'Carte' },
  { value: 'cash', label: 'Espèces' },
  { value: 'direct_debit', label: 'Prélèvement' },
];

export function statusTone(status: string) {
  if (status === 'draft') return 'bg-slate-100 text-slate-700';
  if (status === 'issued') return 'bg-sky-100 text-sky-800';
  if (status === 'partial') return 'bg-amber-100 text-amber-900';
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(n || 0);
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function isOverdue(inv: {
  balance: number;
  dueAt?: string | null;
  status: string;
}) {
  if (inv.balance <= 0 || inv.status === 'paid' || inv.status === 'cancelled')
    return false;
  if (!inv.dueAt) return false;
  return new Date(inv.dueAt) < new Date();
}
