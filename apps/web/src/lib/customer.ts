export type CustomerContact = {
  id: string;
  civility?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  role?: string | null;
  department?: string | null;
  isPrimary: boolean;
  isBilling: boolean;
  isOps: boolean;
  notes?: string | null;
};

export type CustomerBank = {
  id: string;
  label: string;
  bankName?: string | null;
  iban?: string | null;
  bic?: string | null;
  accountHolder?: string | null;
  rum?: string | null;
  isDefault: boolean;
  notes?: string | null;
};

export type CustomerDestination = {
  id: string;
  label: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  contactName?: string | null;
  phone?: string | null;
  notes?: string | null;
  lastUsedAt?: string | null;
};

export type CustomerDocument = {
  id: string;
  name: string;
  category: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  uploadedAt: string;
};

export type CustomerComment = {
  id: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
};

export type CustomerDetail = {
  id: string;
  reference?: string | null;
  name: string;
  tradeName?: string | null;
  type: string;
  siret?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  billingSameAsMain: boolean;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingCountry?: string | null;
  paymentTermsDays: number;
  paymentMethod?: string | null;
  creditLimit?: number | null;
  currency?: string | null;
  alertNote?: string | null;
  notes?: string | null;
  internalRemarks?: string | null;
  preferredVehicleNotes?: string | null;
  preferredDriverNotes?: string | null;
  accountManagerId?: string | null;
  accountManager?: {
    id: string;
    email: string;
    displayName: string;
  } | null;
  apeCode?: string | null;
  invoiceEmail?: string | null;
  requirePurchaseOrder?: boolean;
  latePenaltyRate?: number | null;
  earlyDiscountRate?: number | null;
  sepaMandateStatus?: string | null;
  contractRef?: string | null;
  contractEndsAt?: string | null;
  pricingNotes?: string | null;
  contacts: CustomerContact[];
  bankAccounts: CustomerBank[];
  destinations: CustomerDestination[];
  documents: CustomerDocument[];
  comments: CustomerComment[];
  quotes: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    origin?: string | null;
    destination?: string | null;
    amountTtc: number;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    amountTtc: number;
    balance: number;
    issuedAt: string;
  }>;
  tripHistory: Array<{
    id: string;
    number: string;
    title: string;
    origin?: string | null;
    destination?: string | null;
    departureAt?: string | null;
    status: string;
  }>;
  _count: {
    quotes: number;
    orders: number;
    invoices: number;
    contacts: number;
    destinations: number;
    documents: number;
  };
};

export const PAYMENT_TERMS = [
  { value: 15, label: '15 jours' },
  { value: 30, label: '30 jours' },
  { value: 45, label: '45 jours' },
  { value: 60, label: '60 jours' },
  { value: 90, label: '90 jours' },
];

export const CUSTOMER_TYPES = [
  { value: 'enterprise', label: 'Entreprise' },
  { value: 'collectivity', label: 'Collectivité' },
  { value: 'association', label: 'Association' },
  { value: 'school', label: 'Établissement scolaire' },
  { value: 'agency', label: 'Agence / Tour-opérateur' },
  { value: 'works_council', label: 'Comité d’entreprise (CSE)' },
  { value: 'individual', label: 'Particulier' },
];

export const DOC_CATEGORIES = [
  { value: 'contrat', label: 'Contrat' },
  { value: 'marche', label: 'Marché / convention' },
  { value: 'kbis', label: 'Kbis / extrait' },
  { value: 'assurance', label: 'Assurance' },
  { value: 'rib', label: 'RIB' },
  { value: 'mandat_sepa', label: 'Mandat SEPA' },
  { value: 'autre', label: 'Autre' },
];
