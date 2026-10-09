/** Permission model: Module × Resource × Action × Scope */

export const MODULES = [
  'dashboard',
  'customers',
  'quotes',
  'orders',
  'missions',
  'courses',
  'services',
  'planning',
  'drivers',
  'hr',
  'fleet',
  'documents',
  'portal',
  'messaging',
  'quality',
  'billing',
  'settings',
  'users',
  'groups',
  'audits',
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const ACTIONS = [
  'list',
  'read',
  'create',
  'update',
  'delete',
  'archive',
  'assign',
  'unassign',
  'publish',
  'unpublish',
  'approve',
  'reject',
  'generate_pdf',
  'download',
  'send',
  'manage',
  'admin',
] as const;

export type ActionKey = (typeof ACTIONS)[number];

export const SCOPES = [
  'self',
  'depot',
  'authorized_depots',
  'company',
  'all_companies',
] as const;

export type ScopeKey = (typeof SCOPES)[number];

export type PermissionKey = `${ModuleKey}:${string}:${ActionKey}`;

export function perm(
  module: ModuleKey,
  resource: string,
  action: ActionKey,
): PermissionKey {
  return `${module}:${resource}:${action}`;
}

/** Catalog of permissions seeded at bootstrap */
export const PERMISSION_CATALOG: Array<{
  key: PermissionKey;
  module: ModuleKey;
  resource: string;
  action: ActionKey;
  label: string;
  sensitive?: boolean;
}> = [
  { key: perm('dashboard', 'widget', 'list'), module: 'dashboard', resource: 'widget', action: 'list', label: 'Voir tableau de bord' },
  { key: perm('customers', 'customer', 'list'), module: 'customers', resource: 'customer', action: 'list', label: 'Lister clients' },
  { key: perm('customers', 'customer', 'read'), module: 'customers', resource: 'customer', action: 'read', label: 'Voir client' },
  { key: perm('customers', 'customer', 'create'), module: 'customers', resource: 'customer', action: 'create', label: 'Créer client' },
  { key: perm('customers', 'customer', 'update'), module: 'customers', resource: 'customer', action: 'update', label: 'Modifier client' },
  { key: perm('customers', 'customer', 'delete'), module: 'customers', resource: 'customer', action: 'delete', label: 'Supprimer client' },
  { key: perm('quotes', 'quote', 'list'), module: 'quotes', resource: 'quote', action: 'list', label: 'Lister devis' },
  { key: perm('quotes', 'quote', 'read'), module: 'quotes', resource: 'quote', action: 'read', label: 'Voir devis' },
  { key: perm('quotes', 'quote', 'create'), module: 'quotes', resource: 'quote', action: 'create', label: 'Créer devis' },
  { key: perm('quotes', 'quote', 'update'), module: 'quotes', resource: 'quote', action: 'update', label: 'Modifier devis' },
  { key: perm('quotes', 'quote', 'approve'), module: 'quotes', resource: 'quote', action: 'approve', label: 'Accepter devis' },
  { key: perm('orders', 'order', 'list'), module: 'orders', resource: 'order', action: 'list', label: 'Lister commandes' },
  { key: perm('orders', 'order', 'read'), module: 'orders', resource: 'order', action: 'read', label: 'Voir commande' },
  { key: perm('orders', 'order', 'create'), module: 'orders', resource: 'order', action: 'create', label: 'Créer commande' },
  { key: perm('orders', 'order', 'update'), module: 'orders', resource: 'order', action: 'update', label: 'Modifier commande' },
  { key: perm('missions', 'mission', 'list'), module: 'missions', resource: 'mission', action: 'list', label: 'Lister missions' },
  { key: perm('missions', 'mission', 'read'), module: 'missions', resource: 'mission', action: 'read', label: 'Voir mission' },
  { key: perm('missions', 'mission', 'create'), module: 'missions', resource: 'mission', action: 'create', label: 'Créer mission' },
  { key: perm('missions', 'mission', 'update'), module: 'missions', resource: 'mission', action: 'update', label: 'Modifier mission' },
  { key: perm('missions', 'mission', 'assign'), module: 'missions', resource: 'mission', action: 'assign', label: 'Affecter mission' },
  { key: perm('missions', 'mission', 'generate_pdf'), module: 'missions', resource: 'mission', action: 'generate_pdf', label: 'Générer billet PDF' },
  { key: perm('courses', 'course', 'list'), module: 'courses', resource: 'course', action: 'list', label: 'Lister courses' },
  { key: perm('courses', 'course', 'create'), module: 'courses', resource: 'course', action: 'create', label: 'Créer course' },
  { key: perm('courses', 'course', 'update'), module: 'courses', resource: 'course', action: 'update', label: 'Modifier course' },
  { key: perm('services', 'service', 'list'), module: 'services', resource: 'service', action: 'list', label: 'Lister services' },
  { key: perm('services', 'service', 'create'), module: 'services', resource: 'service', action: 'create', label: 'Créer service' },
  { key: perm('services', 'service', 'update'), module: 'services', resource: 'service', action: 'update', label: 'Modifier service' },
  { key: perm('planning', 'assignment', 'list'), module: 'planning', resource: 'assignment', action: 'list', label: 'Voir planning' },
  { key: perm('planning', 'assignment', 'assign'), module: 'planning', resource: 'assignment', action: 'assign', label: 'Affecter planning' },
  { key: perm('planning', 'assignment', 'unassign'), module: 'planning', resource: 'assignment', action: 'unassign', label: 'Désaffecter' },
  { key: perm('planning', 'assignment', 'publish'), module: 'planning', resource: 'assignment', action: 'publish', label: 'Publier planning' },
  { key: perm('drivers', 'driver', 'list'), module: 'drivers', resource: 'driver', action: 'list', label: 'Lister conducteurs' },
  { key: perm('drivers', 'driver', 'read'), module: 'drivers', resource: 'driver', action: 'read', label: 'Voir conducteur' },
  { key: perm('drivers', 'driver', 'create'), module: 'drivers', resource: 'driver', action: 'create', label: 'Créer conducteur' },
  { key: perm('drivers', 'driver', 'update'), module: 'drivers', resource: 'driver', action: 'update', label: 'Modifier conducteur' },
  { key: perm('hr', 'employee', 'list'), module: 'hr', resource: 'employee', action: 'list', label: 'Lister salariés' },
  { key: perm('hr', 'employee', 'read'), module: 'hr', resource: 'employee', action: 'read', label: 'Voir salarié' },
  { key: perm('hr', 'employee', 'update'), module: 'hr', resource: 'employee', action: 'update', label: 'Modifier salarié' },
  { key: perm('hr', 'leave', 'approve'), module: 'hr', resource: 'leave', action: 'approve', label: 'Valider congés' },
  { key: perm('hr', 'sensitive', 'read'), module: 'hr', resource: 'sensitive', action: 'read', label: 'Données RH sensibles', sensitive: true },
  { key: perm('hr', 'prepPayroll', 'list'), module: 'hr', resource: 'prepPayroll', action: 'list', label: 'Voir prépaye' },
  { key: perm('hr', 'prepPayroll', 'manage'), module: 'hr', resource: 'prepPayroll', action: 'manage', label: 'Gérer prépaye' },
  { key: perm('fleet', 'vehicle', 'list'), module: 'fleet', resource: 'vehicle', action: 'list', label: 'Lister véhicules' },
  { key: perm('fleet', 'vehicle', 'read'), module: 'fleet', resource: 'vehicle', action: 'read', label: 'Voir véhicule' },
  { key: perm('fleet', 'vehicle', 'create'), module: 'fleet', resource: 'vehicle', action: 'create', label: 'Créer véhicule' },
  { key: perm('fleet', 'vehicle', 'update'), module: 'fleet', resource: 'vehicle', action: 'update', label: 'Modifier véhicule' },
  { key: perm('fleet', 'workshop', 'list'), module: 'fleet', resource: 'workshop', action: 'list', label: 'Voir atelier' },
  { key: perm('fleet', 'workshop', 'manage'), module: 'fleet', resource: 'workshop', action: 'manage', label: 'Gérer atelier' },
  { key: perm('dashboard', 'analytics', 'list'), module: 'dashboard', resource: 'analytics', action: 'list', label: 'BI / budgets' },
  { key: perm('documents', 'document', 'list'), module: 'documents', resource: 'document', action: 'list', label: 'Lister documents' },
  { key: perm('documents', 'document', 'download'), module: 'documents', resource: 'document', action: 'download', label: 'Télécharger documents' },
  { key: perm('portal', 'access', 'manage'), module: 'portal', resource: 'access', action: 'manage', label: 'Gérer accès portail' },
  { key: perm('portal', 'publication', 'publish'), module: 'portal', resource: 'publication', action: 'publish', label: 'Publier au portail' },
  { key: perm('messaging', 'thread', 'list'), module: 'messaging', resource: 'thread', action: 'list', label: 'Messagerie exploitation' },
  { key: perm('messaging', 'thread', 'create'), module: 'messaging', resource: 'thread', action: 'create', label: 'Envoyer message' },
  { key: perm('quality', 'incident', 'list'), module: 'quality', resource: 'incident', action: 'list', label: 'Lister incidents' },
  { key: perm('quality', 'incident', 'create'), module: 'quality', resource: 'incident', action: 'create', label: 'Créer incident' },
  { key: perm('billing', 'invoice', 'list'), module: 'billing', resource: 'invoice', action: 'list', label: 'Lister factures' },
  { key: perm('billing', 'invoice', 'download'), module: 'billing', resource: 'invoice', action: 'download', label: 'Exporter factures' },
  { key: perm('settings', 'company', 'manage'), module: 'settings', resource: 'company', action: 'manage', label: 'Paramètres société' },
  { key: perm('users', 'account', 'list'), module: 'users', resource: 'account', action: 'list', label: 'Lister utilisateurs' },
  { key: perm('users', 'account', 'manage'), module: 'users', resource: 'account', action: 'manage', label: 'Administrer comptes' },
  { key: perm('groups', 'group', 'list'), module: 'groups', resource: 'group', action: 'list', label: 'Lister groupes' },
  { key: perm('groups', 'group', 'manage'), module: 'groups', resource: 'group', action: 'manage', label: 'Administrer groupes' },
  { key: perm('audits', 'event', 'list'), module: 'audits', resource: 'event', action: 'list', label: 'Journal d’audit' },
];

export const PRESET_GROUPS = [
  'super_admin',
  'company_admin',
  'direction',
  'ops_manager',
  'dispatcher',
  'fleet_manager',
  'sales_manager',
  'sales',
  'hr_manager',
  'prepPayroll',
  'accountant',
  'workshop_manager',
  'mechanic',
  'driver',
  'client',
  'subcontractor',
] as const;

export type PresetGroup = (typeof PRESET_GROUPS)[number];
