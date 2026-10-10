/** Constantes métier transport de voyageurs — module commercial */

export const SERVICE_TYPES = [
  { value: 'aller_retour', label: 'Aller-retour' },
  { value: 'aller_simple', label: 'Aller simple' },
  { value: 'mad', label: 'Mise à disposition' },
  { value: 'circuit', label: 'Circuit / tour' },
  { value: 'transfert', label: 'Transfert (gare / aéroport)' },
  { value: 'scolaire', label: 'Transport scolaire' },
  { value: 'evenementiel', label: 'Événementiel' },
] as const;

export const LINE_KINDS = [
  { value: 'transport', label: 'Transport' },
  { value: 'toll', label: 'Péages' },
  { value: 'parking', label: 'Parking' },
  { value: 'meal', label: 'Repas chauffeur' },
  { value: 'hotel', label: 'Hôtel / nuitée' },
  { value: 'option', label: 'Option / prestation' },
  { value: 'other', label: 'Autre' },
] as const;

export const LINE_UNITS = [
  { value: 'forfait', label: 'Forfait' },
  { value: 'km', label: 'Km' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'pax', label: 'Passager' },
  { value: 'unite', label: 'Unité' },
] as const;

export const SEPA_STATUS = [
  { value: 'none', label: 'Aucun' },
  { value: 'pending', label: 'En attente' },
  { value: 'active', label: 'Actif' },
  { value: 'revoked', label: 'Révoqué' },
] as const;

export const ORDER_STATUS: Record<string, string> = {
  confirmed: 'Confirmée',
  planned: 'Planifiée',
  in_progress: 'En cours',
  published: 'Publiée',
  done: 'Terminée',
  cancelled: 'Annulée',
};

export type QuoteLineForm = {
  kind: string;
  label: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
};

export function lineAmount(l: { quantity: number; unitPriceHt: number }) {
  return Math.round(l.quantity * l.unitPriceHt * 100) / 100;
}
