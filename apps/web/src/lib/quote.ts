export type QuoteSalesperson = {
  id: string;
  email: string;
  displayName: string;
};

export type QuoteContact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  isPrimary?: boolean;
};

export type QuoteCustomer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  contacts?: QuoteContact[];
};

export type VehicleCategory = {
  id: string;
  code: string;
  name: string;
  defaultSeats: number;
  description?: string | null;
};

export type QuoteLine = {
  id?: string;
  kind: string;
  label: string;
  unit: string;
  quantity: number;
  unitPriceHt: number;
  amountHt: number;
  sortOrder?: number;
};

export type QuoteDetail = {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  status: string;
  caseType: string;
  serviceType?: string;
  source: string;
  customerId: string;
  contactId?: string | null;
  salespersonId?: string | null;
  origin?: string | null;
  originAddress?: string | null;
  destination?: string | null;
  destinationAddress?: string | null;
  distanceKm?: number | null;
  durationDays?: number | null;
  departureAt?: string | null;
  returnAt?: string | null;
  garageDepartureAt?: string | null;
  presentationAt?: string | null;
  onSiteAt?: string | null;
  returnDepartureAt?: string | null;
  returnGarageAt?: string | null;
  vehicleCount: number;
  vehicleCategoryId?: string | null;
  passengers: number;
  amountHt: number;
  proposedPriceHt: number;
  vatRate: number;
  amountTtc: number;
  marginEst?: number | null;
  depositPercent?: number;
  depositAmountHt?: number;
  customerPoNumber?: string | null;
  billingEmail?: string | null;
  luggageNotes?: string | null;
  accessibilityNotes?: string | null;
  optionsNotes?: string | null;
  costTolls?: number;
  costParking?: number;
  costDriverMeals?: number;
  costHotel?: number;
  costMisc?: number;
  refusedReason?: string | null;
  requestReceivedAt?: string | null;
  requestChannel?: string | null;
  proposedAt?: string | null;
  validUntil?: string | null;
  acceptedAt?: string | null;
  announcedAt?: string | null;
  invoicedAt?: string | null;
  dayDetails?: string | null;
  internalNotes?: string | null;
  publishedToPortal: boolean;
  publishedAt?: string | null;
  availabilityNote?: string | null;
  availabilityConfidence?: string | null;
  version: number;
  createdAt: string;
  customer: QuoteCustomer;
  contact?: QuoteContact | null;
  salesperson?: QuoteSalesperson | null;
  vehicleCategory?: VehicleCategory | null;
  lines?: QuoteLine[];
  invoices?: Array<{ id: string; number: string; status: string; kind: string }>;
  order?: {
    id: string;
    number: string;
    missions?: Array<{ id: string; number: string; status: string }>;
  } | null;
};

export type QuotesMeta = {
  categories: VehicleCategory[];
  salespeople: QuoteSalesperson[];
  customers: QuoteCustomer[];
};

export const QUOTE_SOURCES = [
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'postal', label: 'Courrier postal' },
  { value: 'portal', label: 'Espace client' },
  { value: 'other', label: 'Autre' },
] as const;

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Proposé',
  accepted: 'Accepté',
  refused: 'Refusé',
  trashed: 'Corbeille',
  planning: 'Planification',
  invoicing: 'Facturation',
};

export function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${toDateInput(iso)}T${toTimeInput(iso)}`;
}

/** Combine date (YYYY-MM-DD) + time (HH:mm) → ISO, or null */
export function combineDateTime(
  date: string,
  time?: string,
): string | null {
  if (!date) return null;
  const t = time && time.length >= 4 ? time : '00:00';
  const d = new Date(`${date}T${t}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(n || 0);
}

export function formatDateFr(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}
