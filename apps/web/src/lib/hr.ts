export function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtEur(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

export function fmtHours(n?: number | null) {
  if (n == null) return '—';
  return `${n.toFixed(2)} h`;
}

export const LEAVE_STATUS: Record<string, string> = {
  submitted: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  cancelled: 'Annulé',
};

export const LEAVE_TYPES: Record<string, string> = {
  conges: 'Congés payés',
  rtt: 'RTT',
  recuperation: 'Récupération',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  autre: 'Autre',
};

export const PAYSLIP_STATUS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

export const INTERVIEW_KINDS: Record<string, string> = {
  annuel: 'Annuel',
  professionnel: 'Professionnel',
  embauche: 'Embauche',
  suivi: 'Suivi',
  disciplinaire: 'Disciplinaire',
  retour_conges: 'Retour congés',
};
