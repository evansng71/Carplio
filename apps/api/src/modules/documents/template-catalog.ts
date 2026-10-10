export type TemplateKind =
  | 'quote'
  | 'invoice'
  | 'planning'
  | 'collective_ticket'
  | 'order'
  | 'payslip';

export type TemplateVariable = {
  key: string;
  label: string;
  sample?: string;
};

export type KindMeta = {
  kind: TemplateKind;
  label: string;
  description: string;
  variables: TemplateVariable[];
};

export const TEMPLATE_KINDS: KindMeta[] = [
  {
    kind: 'quote',
    label: 'Devis commercial',
    description: 'Document proposé au client (bouton Imprimer sur le devis)',
    variables: [
      { key: 'company.name', label: 'Nom de la société' },
      { key: 'company.tradeName', label: 'Enseigne commerciale' },
      { key: 'company.siret', label: 'Numéro SIRET' },
      { key: 'company.vatNumber', label: 'Numéro de TVA' },
      { key: 'company.logoUrl', label: 'Logo (adresse image)' },
      { key: 'quote.number', label: 'Numéro du devis' },
      { key: 'quote.title', label: 'Objet / destination' },
      { key: 'quote.description', label: 'Description du trajet' },
      { key: 'quote.status', label: 'Statut du devis' },
      { key: 'quote.origin', label: 'Lieu de prise en charge' },
      { key: 'quote.originAddress', label: 'Adresse de prise en charge' },
      { key: 'quote.destination', label: 'Lieu d’arrivée' },
      { key: 'quote.destinationAddress', label: 'Adresse d’arrivée' },
      { key: 'quote.departureAt', label: 'Date et heure de départ' },
      { key: 'quote.returnAt', label: 'Date et heure de retour' },
      { key: 'quote.garageDepartureAt', label: 'Heure de départ garage' },
      { key: 'quote.presentationAt', label: 'Heure de présentation' },
      { key: 'quote.onSiteAt', label: 'Heure sur place' },
      { key: 'quote.returnDepartureAt', label: 'Heure de départ retour' },
      { key: 'quote.returnGarageAt', label: 'Heure de retour garage' },
      { key: 'quote.vehicleCount', label: 'Nombre de cars' },
      { key: 'quote.vehicleCategory', label: 'Type de car' },
      { key: 'quote.passengers', label: 'Nombre de passagers' },
      { key: 'quote.amountHt', label: 'Prix catalogue HT' },
      { key: 'quote.proposedPriceHt', label: 'Prix proposé HT' },
      { key: 'quote.vatRate', label: 'Taux de TVA' },
      { key: 'quote.amountTtc', label: 'Montant TTC' },
      { key: 'quote.proposedAt', label: 'Date du devis' },
      { key: 'quote.validUntil', label: 'Fin de validité' },
      { key: 'quote.dayDetails', label: 'Détails jour par jour' },
      { key: 'customer.name', label: 'Nom du client' },
      { key: 'customer.email', label: 'E-mail du client' },
      { key: 'customer.phone', label: 'Téléphone du client' },
      { key: 'customer.address', label: 'Adresse du client' },
      { key: 'contact.name', label: 'Nom du contact' },
      { key: 'contact.email', label: 'E-mail du contact' },
      { key: 'salesperson.name', label: 'Nom du commercial' },
      { key: 'salesperson.email', label: 'E-mail du commercial' },
      { key: 'today', label: 'Date du jour (impression)' },
    ],
  },
  {
    kind: 'invoice',
    label: 'Facture',
    description: 'Document de facturation (bouton Imprimer sur la facture)',
    variables: [
      { key: 'company.name', label: 'Nom de la société' },
      { key: 'company.siret', label: 'Numéro SIRET' },
      { key: 'company.vatNumber', label: 'Numéro de TVA' },
      { key: 'invoice.number', label: 'Numéro de facture' },
      { key: 'invoice.status', label: 'Statut' },
      { key: 'invoice.amountHt', label: 'Montant HT' },
      { key: 'invoice.vatRate', label: 'Taux de TVA' },
      { key: 'invoice.amountTtc', label: 'Montant TTC' },
      { key: 'invoice.balance', label: 'Solde restant dû' },
      { key: 'invoice.issuedAt', label: 'Date d’émission' },
      { key: 'invoice.notes', label: 'Notes / mentions' },
      { key: 'invoice.linesHtml', label: 'Tableau des lignes' },
      { key: 'customer.name', label: 'Nom du client' },
      { key: 'customer.address', label: 'Adresse du client' },
      { key: 'today', label: 'Date du jour (impression)' },
    ],
  },
  {
    kind: 'planning',
    label: 'Feuille de planning',
    description: 'Impression du planning (bouton Imprimer sur le planning)',
    variables: [
      { key: 'company.name', label: 'Nom de la société' },
      { key: 'planning.title', label: 'Titre du planning' },
      { key: 'planning.period', label: 'Période affichée' },
      { key: 'planning.rowsHtml', label: 'Tableau des affectations' },
      { key: 'today', label: 'Date du jour (impression)' },
    ],
  },
  {
    kind: 'collective_ticket',
    label: 'Billet collectif',
    description: 'Billet de mission (bouton Imprimer sur la mission)',
    variables: [
      { key: 'company.name', label: 'Nom de la société' },
      { key: 'company.siret', label: 'Numéro SIRET' },
      { key: 'mission.number', label: 'Numéro de mission' },
      { key: 'mission.title', label: 'Intitulé de la mission' },
      { key: 'mission.origin', label: 'Lieu de départ' },
      { key: 'mission.destination', label: 'Lieu d’arrivée' },
      { key: 'mission.startsAt', label: 'Heure de départ' },
      { key: 'mission.endsAt', label: 'Heure d’arrivée' },
      { key: 'mission.passengers', label: 'Nombre de voyageurs' },
      { key: 'customer.name', label: 'Nom du client' },
      { key: 'driver.name', label: 'Nom du conducteur' },
      { key: 'vehicle.plate', label: 'Immatriculation' },
      { key: 'vehicle.fleetNumber', label: 'Numéro de parc' },
      { key: 'today', label: 'Date du jour (impression)' },
    ],
  },
  {
    kind: 'order',
    label: 'Confirmation de commande',
    description: 'Bon de commande client',
    variables: [
      { key: 'company.name', label: 'Nom de la société' },
      { key: 'order.number', label: 'Numéro de commande' },
      { key: 'order.title', label: 'Intitulé' },
      { key: 'order.status', label: 'Statut' },
      { key: 'customer.name', label: 'Nom du client' },
      { key: 'quote.number', label: 'Numéro du devis lié' },
      { key: 'today', label: 'Date du jour (impression)' },
    ],
  },
  {
    kind: 'payslip',
    label: 'Bulletin de paie',
    description:
      'Fiche de paie salarié (Imprimer / PDF depuis Paie ou fiche salarié)',
    variables: [
      { key: 'company.name', label: 'Nom de la société' },
      { key: 'company.tradeName', label: 'Enseigne' },
      { key: 'company.siret', label: 'SIRET' },
      { key: 'company.vatNumber', label: 'TVA' },
      { key: 'company.address', label: 'Adresse société' },
      { key: 'employee.matricule', label: 'Matricule' },
      { key: 'employee.fullName', label: 'Nom complet' },
      { key: 'employee.firstName', label: 'Prénom' },
      { key: 'employee.lastName', label: 'Nom' },
      { key: 'employee.jobTitle', label: 'Poste' },
      { key: 'employee.contractType', label: 'Type de contrat' },
      { key: 'employee.classification', label: 'Classification' },
      { key: 'employee.ssnMasked', label: 'N° sécu (masqué)' },
      { key: 'employee.address', label: 'Adresse salarié' },
      { key: 'employee.depot', label: 'Dépôt' },
      { key: 'payslip.yearMonth', label: 'Période YYYY-MM' },
      { key: 'payslip.periodLabel', label: 'Période libellé' },
      { key: 'payslip.status', label: 'Statut' },
      { key: 'payslip.workedHours', label: 'Heures travaillées' },
      { key: 'payslip.overtimeHours', label: 'Heures supp.' },
      { key: 'payslip.nightHours', label: 'Heures de nuit' },
      { key: 'payslip.leaveDays', label: 'Jours de congés' },
      { key: 'payslip.baseSalary', label: 'Salaire de base' },
      { key: 'payslip.grossAmount', label: 'Brut' },
      { key: 'payslip.employeeCharges', label: 'Charges salariales' },
      { key: 'payslip.employerCharges', label: 'Charges patronales' },
      { key: 'payslip.netAmount', label: 'Net à payer' },
      { key: 'payslip.employerCost', label: 'Coût employeur' },
      { key: 'payslip.linesHtml', label: 'Tableau des rubriques' },
      { key: 'payslip.notes', label: 'Notes' },
      { key: 'today', label: 'Date du jour' },
    ],
  },
];

const BASE_CSS = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 18px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .muted { color: #64748b; font-size: 9pt; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 4px; text-align: left; font-size: 10pt; }
  th { color: #64748b; font-weight: 600; font-size: 8pt; text-transform: uppercase; }
  .totals { text-align: right; margin-top: 16px; }
  .totals strong { font-size: 14pt; }
  .footer { margin-top: 28px; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 999px; font-size: 9pt; }
`;

export const DEFAULT_TEMPLATES: Array<{
  kind: TemplateKind;
  key: string;
  name: string;
  description: string;
  bodyHtml: string;
  headerHtml?: string;
  footerHtml?: string;
  stylesCss?: string;
}> = [
  {
    kind: 'quote',
    key: 'quote_default',
    name: 'Devis standard',
    description: 'Modèle commercial A4 avec en-tête société et détail trajet',
    stylesCss: BASE_CSS,
    bodyHtml: `
<header class="row">
  <div>
    <h1>{{company.tradeName|fallback:company.name}}</h1>
    <div class="muted">{{company.name}} · SIRET {{company.siret}}</div>
    <div class="muted">TVA {{company.vatNumber}}</div>
  </div>
  <div style="text-align:right">
    <div class="badge">DEVIS {{quote.number}}</div>
    <div style="margin-top:8px">Date : <strong>{{quote.proposedAt}}</strong></div>
    <div>Validité : <strong>{{quote.validUntil}}</strong></div>
  </div>
</header>

<div class="row" style="margin-top:20px">
  <div class="box">
    <div class="muted">Client</div>
    <strong>{{customer.name}}</strong><br/>
    {{customer.address}}<br/>
    {{customer.email}} · {{customer.phone}}
  </div>
  <div class="box">
    <div class="muted">Contact / Commercial</div>
    Contact : <strong>{{contact.name}}</strong><br/>
    Commercial : <strong>{{salesperson.name}}</strong>
  </div>
</div>

<h2>{{quote.title}}</h2>
<p>{{quote.description}}</p>

<table>
  <thead>
    <tr><th>Trajet</th><th>Horaires</th><th>Flotte</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <strong>{{quote.origin}}</strong><br/>{{quote.originAddress}}<br/>
        → <strong>{{quote.destination}}</strong><br/>{{quote.destinationAddress}}
      </td>
      <td>
        Départ : {{quote.departureAt}}<br/>
        Garage : {{quote.garageDepartureAt}}<br/>
        Présentation : {{quote.presentationAt}}<br/>
        Retour : {{quote.returnAt}}
      </td>
      <td>
        {{quote.vehicleCount}} × {{quote.vehicleCategory}}<br/>
        {{quote.passengers}} passagers
      </td>
    </tr>
  </tbody>
</table>

<div class="totals">
  <div>Prix catalogue HT : {{quote.amountHt}}</div>
  <div>Prix proposé HT : {{quote.proposedPriceHt}}</div>
  <div>TVA {{quote.vatRate}} %</div>
  <div><strong>Total TTC : {{quote.amountTtc}}</strong></div>
</div>

<div class="footer">
  Document généré le {{today}} — {{company.name}}. Ce devis est valable jusqu’au {{quote.validUntil}}.
</div>
`.trim(),
  },
  {
    kind: 'invoice',
    key: 'invoice_default',
    name: 'Facture standard',
    description: 'Facture A4 avec lignes et totaux',
    stylesCss: BASE_CSS,
    bodyHtml: `
<header class="row">
  <div>
    <h1>{{company.name}}</h1>
    <div class="muted">SIRET {{company.siret}} · TVA {{company.vatNumber}}</div>
  </div>
  <div style="text-align:right">
    <div class="badge">FACTURE {{invoice.number}}</div>
    <div style="margin-top:8px">Émise le <strong>{{invoice.issuedAt}}</strong></div>
  </div>
</header>

<div class="box" style="margin-top:20px">
  <div class="muted">Facturé à</div>
  <strong>{{customer.name}}</strong><br/>
  {{customer.address}}
</div>

<h2>Détail</h2>
{{invoice.linesHtml}}

<div class="totals">
  <div>HT : {{invoice.amountHt}}</div>
  <div>TVA {{invoice.vatRate}} %</div>
  <div><strong>TTC : {{invoice.amountTtc}}</strong></div>
  <div class="muted">Solde : {{invoice.balance}}</div>
</div>

<p>{{invoice.notes}}</p>
<div class="footer">Document généré le {{today}} — {{company.name}}</div>
`.trim(),
  },
  {
    kind: 'planning',
    key: 'planning_default',
    name: 'Planning journée',
    description: 'Liste des affectations sur une période',
    stylesCss: BASE_CSS,
    bodyHtml: `
<header class="row">
  <div>
    <h1>Planning</h1>
    <div class="muted">{{company.name}}</div>
  </div>
  <div style="text-align:right">
    <strong>{{planning.title}}</strong><br/>
    <span class="muted">{{planning.period}}</span>
  </div>
</header>

<h2>Affectations</h2>
{{planning.rowsHtml}}

<div class="footer">Édité le {{today}} — {{company.name}}</div>
`.trim(),
  },
  {
    kind: 'collective_ticket',
    key: 'collective_ticket_default',
    name: 'Billet collectif',
    description: 'Billet mission conducteur / contrôle',
    stylesCss: BASE_CSS,
    bodyHtml: `
<header style="text-align:center">
  <h1>BILLET COLLECTIF</h1>
  <div class="muted">{{company.name}} · SIRET {{company.siret}}</div>
</header>

<div class="row" style="margin-top:24px">
  <div class="box">
    <div class="muted">Mission</div>
    <strong>{{mission.number}}</strong><br/>
    {{mission.title}}
  </div>
  <div class="box">
    <div class="muted">Client</div>
    <strong>{{customer.name}}</strong>
  </div>
</div>

<table style="margin-top:16px">
  <tr><th>Départ</th><td>{{mission.startsAt}}</td></tr>
  <tr><th>Arrivée</th><td>{{mission.endsAt}}</td></tr>
  <tr><th>Trajet</th><td>{{mission.origin}} → {{mission.destination}}</td></tr>
  <tr><th>Voyageurs</th><td>{{mission.passengers}}</td></tr>
  <tr><th>Conducteur</th><td>{{driver.name}}</td></tr>
  <tr><th>Véhicule</th><td>{{vehicle.fleetNumber}} — {{vehicle.plate}}</td></tr>
</table>

<div class="footer">
  Document généré le {{today}}. Mentions réglementaires à valider avant usage production.
</div>
`.trim(),
  },
  {
    kind: 'order',
    key: 'order_default',
    name: 'Confirmation de commande',
    description: 'Bon de commande client',
    stylesCss: BASE_CSS,
    bodyHtml: `
<header class="row">
  <div>
    <h1>{{company.name}}</h1>
    <div class="muted">Confirmation de commande</div>
  </div>
  <div style="text-align:right">
    <div class="badge">{{order.number}}</div>
    <div style="margin-top:8px">{{today}}</div>
  </div>
</header>

<div class="box" style="margin-top:20px">
  <strong>{{customer.name}}</strong><br/>
  Commande : {{order.title}}<br/>
  Statut : {{order.status}}<br/>
  Devis lié : {{quote.number}}
</div>

<div class="footer">{{company.name}} — document généré le {{today}}</div>
`.trim(),
  },
  {
    kind: 'payslip',
    key: 'payslip_default',
    name: 'Bulletin de paie standard',
    description: 'Bulletin A4 avec rubriques, totaux et en-tête société',
    stylesCss: `${BASE_CSS}
  .payslip-meta td { border: none; padding: 2px 8px 2px 0; }
  .net-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; text-align: right; margin-top: 12px; }
  .net-box strong { font-size: 16pt; color: #166534; }
`,
    bodyHtml: `
<header class="row">
  <div>
    <h1>{{company.tradeName|fallback:company.name}}</h1>
    <div class="muted">{{company.name}} · SIRET {{company.siret}}</div>
    <div class="muted">{{company.address}}</div>
  </div>
  <div style="text-align:right">
    <div class="badge">BULLETIN DE PAIE</div>
    <div style="margin-top:8px"><strong>{{payslip.periodLabel}}</strong></div>
    <div class="muted">Édité le {{today}}</div>
  </div>
</header>

<div class="row" style="margin-top:18px">
  <div class="box">
    <div class="muted">Salarié</div>
    <strong>{{employee.fullName}}</strong><br/>
    Matricule {{employee.matricule}}<br/>
    {{employee.jobTitle}} · {{employee.contractType}}<br/>
    {{employee.classification}}<br/>
    {{employee.address}}
  </div>
  <div class="box">
    <div class="muted">Période &amp; heures</div>
    <table class="payslip-meta">
      <tr><td>Dépôt</td><td><strong>{{employee.depot}}</strong></td></tr>
      <tr><td>Heures</td><td><strong>{{payslip.workedHours}}</strong></td></tr>
      <tr><td>HS</td><td>{{payslip.overtimeHours}}</td></tr>
      <tr><td>Nuit</td><td>{{payslip.nightHours}}</td></tr>
      <tr><td>Congés (j)</td><td>{{payslip.leaveDays}}</td></tr>
      <tr><td>N° sécu</td><td>{{employee.ssnMasked}}</td></tr>
    </table>
  </div>
</div>

<h2>Rubriques</h2>
{{payslip.linesHtml}}

<div class="row" style="margin-top:16px">
  <div class="box">
    <div>Salaire de base : <strong>{{payslip.baseSalary}}</strong></div>
    <div>Brut : <strong>{{payslip.grossAmount}}</strong></div>
    <div>Charges salariales : {{payslip.employeeCharges}}</div>
    <div class="muted">Charges patronales : {{payslip.employerCharges}}</div>
    <div class="muted">Coût employeur : {{payslip.employerCost}}</div>
  </div>
  <div class="net-box" style="flex:1">
    <div class="muted">Net à payer</div>
    <strong>{{payslip.netAmount}}</strong>
  </div>
</div>

<p class="muted" style="margin-top:12px">{{payslip.notes}}</p>
<div class="footer">
  Bulletin {{payslip.yearMonth}} — {{company.name}}. Document généré le {{today}}.
  Conservez ce bulletin. Modèle personnalisable dans Administration → Modèles.
</div>
`.trim(),
  },
];
