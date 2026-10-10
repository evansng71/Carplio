/** Blocs de mise en page pour l’éditeur de modèles (compilés en HTML). */

export type FieldPick = { label: string; key: string };

export type DocBlock =
  | {
      id: string;
      type: 'company_header';
      showTradeName: boolean;
      showSiret: boolean;
      showVat: boolean;
    }
  | {
      id: string;
      type: 'document_title';
      /** ex. DEVIS, FACTURE */
      badgeLabel: string;
      numberKey: string;
      dateLabel: string;
      dateKey: string;
      extraLabel?: string;
      extraKey?: string;
    }
  | {
      id: string;
      type: 'info_cards';
      leftTitle: string;
      leftLines: FieldPick[];
      rightTitle: string;
      rightLines: FieldPick[];
    }
  | {
      id: string;
      type: 'section_title';
      /** Texte libre ou {{variable}} */
      text: string;
    }
  | {
      id: string;
      type: 'text';
      text: string;
    }
  | {
      id: string;
      type: 'trip_summary';
    }
  | {
      id: string;
      type: 'key_value_table';
      rows: FieldPick[];
    }
  | {
      id: string;
      type: 'pricing_quote';
    }
  | {
      id: string;
      type: 'pricing_invoice';
    }
  | {
      id: string;
      type: 'html_slot';
      /** Variable HTML pré-générée, ex. invoice.linesHtml */
      key: string;
      title?: string;
    }
  | {
      id: string;
      type: 'footer_note';
      text: string;
    }
  | {
      id: string;
      type: 'spacer';
      size: 'sm' | 'md' | 'lg';
    };

export type LayoutDoc = {
  version: 1;
  blocks: DocBlock[];
};

export function uid() {
  return `b_${Math.random().toString(36).slice(2, 9)}`;
}

export const BLOCK_LIBRARY: Array<{
  type: DocBlock['type'];
  label: string;
  hint: string;
  kinds?: string[];
  create: () => DocBlock;
}> = [
  {
    type: 'company_header',
    label: 'En-tête société',
    hint: 'Nom, SIRET, TVA de votre entreprise',
    create: () => ({
      id: uid(),
      type: 'company_header',
      showTradeName: true,
      showSiret: true,
      showVat: true,
    }),
  },
  {
    type: 'document_title',
    label: 'Titre du document',
    hint: 'Badge + numéro + dates',
    create: () => ({
      id: uid(),
      type: 'document_title',
      badgeLabel: 'DEVIS',
      numberKey: 'quote.number',
      dateLabel: 'Date',
      dateKey: 'quote.proposedAt',
      extraLabel: 'Validité',
      extraKey: 'quote.validUntil',
    }),
  },
  {
    type: 'info_cards',
    label: 'Deux encadrés (client / contact)',
    hint: 'Colonnes d’informations côte à côte',
    create: () => ({
      id: uid(),
      type: 'info_cards',
      leftTitle: 'Client',
      leftLines: [
        { label: 'Nom', key: 'customer.name' },
        { label: 'Adresse', key: 'customer.address' },
        { label: 'E-mail', key: 'customer.email' },
        { label: 'Téléphone', key: 'customer.phone' },
      ],
      rightTitle: 'Contact & commercial',
      rightLines: [
        { label: 'Contact', key: 'contact.name' },
        { label: 'Commercial', key: 'salesperson.name' },
      ],
    }),
  },
  {
    type: 'section_title',
    label: 'Titre de section',
    hint: 'Ex. objet du devis',
    create: () => ({
      id: uid(),
      type: 'section_title',
      text: '{{quote.title}}',
    }),
  },
  {
    type: 'text',
    label: 'Texte / paragraphe',
    hint: 'Texte libre avec champs dynamiques',
    create: () => ({
      id: uid(),
      type: 'text',
      text: '{{quote.description}}',
    }),
  },
  {
    type: 'trip_summary',
    label: 'Récapitulatif trajet',
    hint: 'Départ, arrivée, horaires, flotte',
    kinds: ['quote'],
    create: () => ({ id: uid(), type: 'trip_summary' }),
  },
  {
    type: 'key_value_table',
    label: 'Tableau libellé / valeur',
    hint: 'Liste de champs personnalisable',
    create: () => ({
      id: uid(),
      type: 'key_value_table',
      rows: [
        { label: 'Départ', key: 'mission.startsAt' },
        { label: 'Arrivée', key: 'mission.endsAt' },
        { label: 'Trajet', key: 'mission.origin' },
      ],
    }),
  },
  {
    type: 'pricing_quote',
    label: 'Totaux devis',
    hint: 'Prix HT, proposé, TVA, TTC',
    kinds: ['quote'],
    create: () => ({ id: uid(), type: 'pricing_quote' }),
  },
  {
    type: 'pricing_invoice',
    label: 'Totaux facture',
    hint: 'HT, TVA, TTC, solde',
    kinds: ['invoice'],
    create: () => ({ id: uid(), type: 'pricing_invoice' }),
  },
  {
    type: 'html_slot',
    label: 'Tableau de lignes',
    hint: 'Lignes générées automatiquement',
    kinds: ['invoice', 'planning', 'payslip'],
    create: () => ({
      id: uid(),
      type: 'html_slot',
      key: 'invoice.linesHtml',
      title: 'Détail',
    }),
  },
  {
    type: 'footer_note',
    label: 'Pied de page',
    hint: 'Mentions légales, date d’édition',
    create: () => ({
      id: uid(),
      type: 'footer_note',
      text: 'Document généré le {{today}} — {{company.name}}.',
    }),
  },
  {
    type: 'spacer',
    label: 'Espace vertical',
    hint: 'Aérer la mise en page',
    create: () => ({ id: uid(), type: 'spacer', size: 'md' }),
  },
];

export function defaultLayoutFor(kind: string): LayoutDoc {
  if (kind === 'quote') {
    return {
      version: 1,
      blocks: [
        {
          id: uid(),
          type: 'company_header',
          showTradeName: true,
          showSiret: true,
          showVat: true,
        },
        {
          id: uid(),
          type: 'document_title',
          badgeLabel: 'DEVIS',
          numberKey: 'quote.number',
          dateLabel: 'Date du devis',
          dateKey: 'quote.proposedAt',
          extraLabel: 'Valable jusqu’au',
          extraKey: 'quote.validUntil',
        },
        {
          id: uid(),
          type: 'info_cards',
          leftTitle: 'Client',
          leftLines: [
            { label: 'Nom', key: 'customer.name' },
            { label: 'Adresse', key: 'customer.address' },
            { label: 'E-mail', key: 'customer.email' },
            { label: 'Téléphone', key: 'customer.phone' },
          ],
          rightTitle: 'Suivi commercial',
          rightLines: [
            { label: 'Contact client', key: 'contact.name' },
            { label: 'Commercial', key: 'salesperson.name' },
          ],
        },
        { id: uid(), type: 'section_title', text: '{{quote.title}}' },
        { id: uid(), type: 'text', text: '{{quote.description}}' },
        { id: uid(), type: 'trip_summary' },
        { id: uid(), type: 'pricing_quote' },
        {
          id: uid(),
          type: 'footer_note',
          text: 'Document généré le {{today}} — {{company.name}}. Ce devis est valable jusqu’au {{quote.validUntil}}.',
        },
      ],
    };
  }
  if (kind === 'invoice') {
    return {
      version: 1,
      blocks: [
        {
          id: uid(),
          type: 'company_header',
          showTradeName: false,
          showSiret: true,
          showVat: true,
        },
        {
          id: uid(),
          type: 'document_title',
          badgeLabel: 'FACTURE',
          numberKey: 'invoice.number',
          dateLabel: 'Émise le',
          dateKey: 'invoice.issuedAt',
        },
        {
          id: uid(),
          type: 'info_cards',
          leftTitle: 'Facturé à',
          leftLines: [
            { label: 'Client', key: 'customer.name' },
            { label: 'Adresse', key: 'customer.address' },
          ],
          rightTitle: '',
          rightLines: [],
        },
        {
          id: uid(),
          type: 'html_slot',
          key: 'invoice.linesHtml',
          title: 'Détail des prestations',
        },
        { id: uid(), type: 'pricing_invoice' },
        {
          id: uid(),
          type: 'footer_note',
          text: 'Document généré le {{today}} — {{company.name}}',
        },
      ],
    };
  }
  if (kind === 'collective_ticket') {
    return {
      version: 1,
      blocks: [
        {
          id: uid(),
          type: 'document_title',
          badgeLabel: 'BILLET COLLECTIF',
          numberKey: 'mission.number',
          dateLabel: 'Édité le',
          dateKey: 'today',
        },
        {
          id: uid(),
          type: 'key_value_table',
          rows: [
            { label: 'Société', key: 'company.name' },
            { label: 'Client', key: 'customer.name' },
            { label: 'Mission', key: 'mission.title' },
            { label: 'Départ', key: 'mission.startsAt' },
            { label: 'Arrivée', key: 'mission.endsAt' },
            { label: 'Origine', key: 'mission.origin' },
            { label: 'Destination', key: 'mission.destination' },
            { label: 'Voyageurs', key: 'mission.passengers' },
            { label: 'Conducteur', key: 'driver.name' },
            { label: 'Véhicule', key: 'vehicle.plate' },
          ],
        },
        {
          id: uid(),
          type: 'footer_note',
          text: 'Document généré le {{today}}. Mentions réglementaires à valider avant usage production.',
        },
      ],
    };
  }
  if (kind === 'planning') {
    return {
      version: 1,
      blocks: [
        {
          id: uid(),
          type: 'company_header',
          showTradeName: true,
          showSiret: false,
          showVat: false,
        },
        { id: uid(), type: 'section_title', text: '{{planning.title}}' },
        { id: uid(), type: 'text', text: 'Période : {{planning.period}}' },
        {
          id: uid(),
          type: 'html_slot',
          key: 'planning.rowsHtml',
          title: 'Affectations',
        },
        {
          id: uid(),
          type: 'footer_note',
          text: 'Édité le {{today}} — {{company.name}}',
        },
      ],
    };
  }
  if (kind === 'payslip') {
    return {
      version: 1,
      blocks: [
        {
          id: uid(),
          type: 'company_header',
          showTradeName: true,
          showSiret: true,
          showVat: false,
        },
        {
          id: uid(),
          type: 'document_title',
          badgeLabel: 'BULLETIN DE PAIE',
          numberKey: 'payslip.yearMonth',
          dateLabel: 'Période',
          dateKey: 'payslip.periodLabel',
        },
        {
          id: uid(),
          type: 'info_cards',
          leftTitle: 'Salarié',
          leftLines: [
            { label: 'Nom', key: 'employee.fullName' },
            { label: 'Matricule', key: 'employee.matricule' },
            { label: 'Poste', key: 'employee.jobTitle' },
            { label: 'Contrat', key: 'employee.contractType' },
          ],
          rightTitle: 'Heures',
          rightLines: [
            { label: 'Travaillées', key: 'payslip.workedHours' },
            { label: 'HS', key: 'payslip.overtimeHours' },
            { label: 'Nuit', key: 'payslip.nightHours' },
            { label: 'Congés', key: 'payslip.leaveDays' },
          ],
        },
        {
          id: uid(),
          type: 'html_slot',
          key: 'payslip.linesHtml',
          title: 'Rubriques',
        },
        {
          id: uid(),
          type: 'key_value_table',
          rows: [
            { label: 'Salaire de base', key: 'payslip.baseSalary' },
            { label: 'Brut', key: 'payslip.grossAmount' },
            { label: 'Charges salariales', key: 'payslip.employeeCharges' },
            { label: 'Net à payer', key: 'payslip.netAmount' },
          ],
        },
        {
          id: uid(),
          type: 'footer_note',
          text: 'Bulletin {{payslip.yearMonth}} — {{company.name}} — {{today}}',
        },
      ],
    };
  }
  return {
    version: 1,
    blocks: [
      {
        id: uid(),
        type: 'company_header',
        showTradeName: true,
        showSiret: true,
        showVat: false,
      },
      {
        id: uid(),
        type: 'document_title',
        badgeLabel: 'COMMANDE',
        numberKey: 'order.number',
        dateLabel: 'Date',
        dateKey: 'today',
      },
      { id: uid(), type: 'section_title', text: '{{order.title}}' },
      {
        id: uid(),
        type: 'key_value_table',
        rows: [
          { label: 'Client', key: 'customer.name' },
          { label: 'Statut', key: 'order.status' },
          { label: 'Devis lié', key: 'quote.number' },
        ],
      },
      {
        id: uid(),
        type: 'footer_note',
        text: '{{company.name}} — {{today}}',
      },
    ],
  };
}

export const PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 16px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .muted { color: #64748b; font-size: 9pt; }
  .row { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
  .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; flex: 1; background: #f8fafc; }
  .box-title { font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #64748b; margin-bottom: 6px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 4px; text-align: left; font-size: 10pt; vertical-align: top; }
  th { color: #64748b; font-weight: 600; font-size: 8pt; text-transform: uppercase; }
  .totals { text-align: right; margin-top: 16px; }
  .totals strong { font-size: 14pt; }
  .footer { margin-top: 24px; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 3px 10px; border-radius: 999px; font-size: 9pt; font-weight: 700; letter-spacing: .02em; }
  .spacer-sm { height: 8px; } .spacer-md { height: 16px; } .spacer-lg { height: 28px; }
`;

function v(key: string) {
  return `{{${key}}}`;
}

function compileBlock(b: DocBlock): string {
  switch (b.type) {
    case 'company_header':
      return `<div>
  <h1>${b.showTradeName ? '{{company.tradeName|fallback:company.name}}' : '{{company.name}}'}</h1>
  ${b.showSiret || b.showVat ? `<div class="muted">${b.showSiret ? 'SIRET {{company.siret}}' : ''}${b.showSiret && b.showVat ? ' · ' : ''}${b.showVat ? 'TVA {{company.vatNumber}}' : ''}</div>` : ''}
</div>`;
    case 'document_title':
      return `<div class="row" style="margin-bottom:16px">
  <div></div>
  <div style="text-align:right">
    <div class="badge">${escape(b.badgeLabel)} ${v(b.numberKey)}</div>
    <div style="margin-top:8px">${escape(b.dateLabel)} : <strong>${v(b.dateKey)}</strong></div>
    ${b.extraKey ? `<div>${escape(b.extraLabel || '')} : <strong>${v(b.extraKey)}</strong></div>` : ''}
  </div>
</div>`;
    case 'info_cards': {
      const left = b.leftLines
        .map((l) =>
          l.label
            ? `${escape(l.label)} : <strong>${v(l.key)}</strong>`
            : `<strong>${v(l.key)}</strong>`,
        )
        .join('<br/>');
      const right = b.rightLines
        .map((l) =>
          l.label
            ? `${escape(l.label)} : <strong>${v(l.key)}</strong>`
            : `<strong>${v(l.key)}</strong>`,
        )
        .join('<br/>');
      return `<div class="row" style="margin-top:12px">
  <div class="box">${b.leftTitle ? `<div class="box-title">${escape(b.leftTitle)}</div>` : ''}${left}</div>
  ${b.rightLines.length ? `<div class="box">${b.rightTitle ? `<div class="box-title">${escape(b.rightTitle)}</div>` : ''}${right}</div>` : ''}
</div>`;
    }
    case 'section_title':
      return `<h2>${b.text}</h2>`;
    case 'text':
      return `<p>${b.text}</p>`;
    case 'trip_summary':
      return `<table>
  <thead><tr><th>Trajet</th><th>Horaires</th><th>Flotte</th></tr></thead>
  <tbody><tr>
    <td><strong>{{quote.origin}}</strong><br/>{{quote.originAddress}}<br/>→ <strong>{{quote.destination}}</strong><br/>{{quote.destinationAddress}}</td>
    <td>Départ : {{quote.departureAt}}<br/>Garage : {{quote.garageDepartureAt}}<br/>Présentation : {{quote.presentationAt}}<br/>Retour : {{quote.returnAt}}</td>
    <td>{{quote.vehicleCount}} × {{quote.vehicleCategory}}<br/>{{quote.passengers}} passagers</td>
  </tr></tbody>
</table>`;
    case 'key_value_table':
      return `<table>${b.rows
        .map(
          (r) =>
            `<tr><th style="width:32%">${escape(r.label)}</th><td>${v(r.key)}</td></tr>`,
        )
        .join('')}</table>`;
    case 'pricing_quote':
      return `<div class="totals">
  <div>Prix catalogue HT : {{quote.amountHt}}</div>
  <div>Prix proposé HT : {{quote.proposedPriceHt}}</div>
  <div>TVA {{quote.vatRate}} %</div>
  <div><strong>Total TTC : {{quote.amountTtc}}</strong></div>
</div>`;
    case 'pricing_invoice':
      return `<div class="totals">
  <div>HT : {{invoice.amountHt}}</div>
  <div>TVA {{invoice.vatRate}} %</div>
  <div><strong>TTC : {{invoice.amountTtc}}</strong></div>
  <div class="muted">Solde : {{invoice.balance}}</div>
</div>`;
    case 'html_slot':
      return `${b.title ? `<h2>${escape(b.title)}</h2>` : ''}${v(b.key)}`;
    case 'footer_note':
      return `<div class="footer">${b.text}</div>`;
    case 'spacer':
      return `<div class="spacer-${b.size}"></div>`;
    default:
      return '';
  }
}

function escape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function compileLayout(layout: LayoutDoc): {
  bodyHtml: string;
  stylesCss: string;
} {
  const bodyHtml = layout.blocks.map(compileBlock).join('\n\n');
  return { bodyHtml, stylesCss: PRINT_CSS };
}

export function parseLayout(json?: string | null): LayoutDoc | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as LayoutDoc;
    if (!parsed?.blocks || !Array.isArray(parsed.blocks)) return null;
    return { version: 1, blocks: parsed.blocks };
  } catch {
    return null;
  }
}

export function blockLabel(b: DocBlock): string {
  const hit = BLOCK_LIBRARY.find((x) => x.type === b.type);
  return hit?.label || b.type;
}

/** Groupes de champs pour le sélecteur (libellés humains). */
export function fieldGroupsFor(
  kind: string,
  variables: Array<{ key: string; label: string }>,
): Array<{ group: string; items: Array<{ key: string; label: string }> }> {
  const groups: Record<string, Array<{ key: string; label: string }>> = {};
  for (const v of variables) {
    const root = v.key.split('.')[0];
    const groupMap: Record<string, string> = {
      company: 'Votre société',
      quote: 'Le devis',
      invoice: 'La facture',
      customer: 'Le client',
      contact: 'Le contact',
      salesperson: 'Le commercial',
      mission: 'La mission',
      driver: 'Le conducteur',
      vehicle: 'Le véhicule',
      planning: 'Le planning',
      order: 'La commande',
      payslip: 'Le bulletin',
      employee: 'Le salarié',
      today: 'Dates',
    };
    const g = groupMap[root] || 'Autres';
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  }
  // Prefer order by kind relevance
  const order =
    kind === 'quote'
      ? ['Votre société', 'Le devis', 'Le client', 'Le contact', 'Le commercial', 'Dates']
      : Object.keys(groups);
  return order
    .filter((g) => groups[g]?.length)
    .concat(Object.keys(groups).filter((g) => !order.includes(g)))
    .filter((g, i, a) => a.indexOf(g) === i)
    .map((group) => ({ group, items: groups[group] }));
}
