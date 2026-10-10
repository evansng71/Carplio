'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, openPrintHtml } from '@/lib/api';
import {
  IconCalendar,
  IconFile,
  IconMap,
  IconSettings,
  IconTile,
} from '@/components/Icons';
import {
  addDaysIso,
  combineDateTime,
  formatMoney,
  QUOTE_SOURCES,
  QUOTE_STATUS_LABELS,
  QuoteDetail,
  QuotesMeta,
  toDateInput,
  toDatetimeLocal,
  toTimeInput,
} from '@/lib/quote';
import {
  LINE_KINDS,
  LINE_UNITS,
  QuoteLineForm,
  SERVICE_TYPES,
  lineAmount,
} from '@/lib/commercial';

type Tab =
  | 'resume'
  | 'lines'
  | 'options'
  | 'accept'
  | 'destination'
  | 'days'
  | 'notes';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'resume', label: 'Résumé' },
  { id: 'lines', label: 'Lignes & coûts' },
  { id: 'options', label: 'Options & acompte' },
  { id: 'accept', label: 'Accepter / Facturer' },
  { id: 'destination', label: 'Destination' },
  { id: 'days', label: 'Détails jours' },
  { id: 'notes', label: 'Notes internes' },
];

type FormState = {
  customerId: string;
  contactId: string;
  salespersonId: string;
  source: string;
  title: string;
  description: string;
  caseType: string;
  serviceType: string;
  origin: string;
  originAddress: string;
  destination: string;
  destinationAddress: string;
  distanceKm: number | '';
  durationDays: number;
  departureDate: string;
  garageDepartureTime: string;
  presentationTime: string;
  departureTime: string;
  onSiteTime: string;
  returnDate: string;
  returnDepartureTime: string;
  returnGarageTime: string;
  vehicleCount: number;
  vehicleCategoryId: string;
  passengers: number;
  amountHt: number;
  proposedPriceHt: number;
  vatRate: number;
  depositPercent: number;
  depositAmountHt: number;
  customerPoNumber: string;
  billingEmail: string;
  luggageNotes: string;
  accessibilityNotes: string;
  optionsNotes: string;
  costTolls: number;
  costParking: number;
  costDriverMeals: number;
  costHotel: number;
  costMisc: number;
  refusedReason: string;
  requestReceivedAt: string;
  requestChannel: string;
  proposedAt: string;
  validUntil: string;
  acceptedAt: string;
  announcedAt: string;
  invoicedAt: string;
  dayDetails: string;
  internalNotes: string;
  lines: QuoteLineForm[];
};

function emptyForm(meta?: QuotesMeta): FormState {
  const today = new Date().toISOString();
  return {
    customerId: meta?.customers[0]?.id || '',
    contactId: '',
    salespersonId: meta?.salespeople[0]?.id || '',
    source: 'email',
    title: '',
    description: '',
    caseType: 'simple',
    serviceType: 'aller_retour',
    origin: '',
    originAddress: '',
    destination: '',
    destinationAddress: '',
    distanceKm: '',
    durationDays: 1,
    departureDate: '',
    garageDepartureTime: '',
    presentationTime: '',
    departureTime: '',
    onSiteTime: '',
    returnDate: '',
    returnDepartureTime: '',
    returnGarageTime: '',
    vehicleCount: 1,
    vehicleCategoryId: meta?.categories[0]?.id || '',
    passengers: meta?.categories[0]?.defaultSeats || 0,
    amountHt: 0,
    proposedPriceHt: 0,
    vatRate: 10,
    depositPercent: 30,
    depositAmountHt: 0,
    customerPoNumber: '',
    billingEmail: '',
    luggageNotes: '',
    accessibilityNotes: '',
    optionsNotes: '',
    costTolls: 0,
    costParking: 0,
    costDriverMeals: 0,
    costHotel: 0,
    costMisc: 0,
    refusedReason: '',
    requestReceivedAt: toDatetimeLocal(today),
    requestChannel: 'email',
    proposedAt: toDateInput(today),
    validUntil: toDateInput(addDaysIso(today, 20)),
    acceptedAt: '',
    announcedAt: '',
    invoicedAt: '',
    dayDetails: '',
    internalNotes: '',
    lines: [
      {
        kind: 'transport',
        label: 'Prestation transport',
        unit: 'forfait',
        quantity: 1,
        unitPriceHt: 0,
      },
    ],
  };
}

function fromQuote(q: QuoteDetail): FormState {
  return {
    customerId: q.customerId,
    contactId: q.contactId || '',
    salespersonId: q.salespersonId || '',
    source: q.source || 'email',
    title: q.title || '',
    description: q.description || '',
    caseType: q.caseType || 'simple',
    serviceType: q.serviceType || 'aller_retour',
    origin: q.origin || '',
    originAddress: q.originAddress || '',
    destination: q.destination || '',
    destinationAddress: q.destinationAddress || '',
    distanceKm: q.distanceKm ?? '',
    durationDays: q.durationDays ?? 1,
    departureDate: toDateInput(q.departureAt),
    garageDepartureTime: toTimeInput(q.garageDepartureAt),
    presentationTime: toTimeInput(q.presentationAt),
    departureTime: toTimeInput(q.departureAt),
    onSiteTime: toTimeInput(q.onSiteAt),
    returnDate: toDateInput(q.returnAt),
    returnDepartureTime: toTimeInput(q.returnDepartureAt || q.returnAt),
    returnGarageTime: toTimeInput(q.returnGarageAt),
    vehicleCount: q.vehicleCount || 1,
    vehicleCategoryId: q.vehicleCategoryId || '',
    passengers: q.passengers || 0,
    amountHt: q.amountHt || 0,
    proposedPriceHt: q.proposedPriceHt || 0,
    vatRate: q.vatRate || 10,
    depositPercent: q.depositPercent ?? 0,
    depositAmountHt: q.depositAmountHt ?? 0,
    customerPoNumber: q.customerPoNumber || '',
    billingEmail: q.billingEmail || '',
    luggageNotes: q.luggageNotes || '',
    accessibilityNotes: q.accessibilityNotes || '',
    optionsNotes: q.optionsNotes || '',
    costTolls: q.costTolls || 0,
    costParking: q.costParking || 0,
    costDriverMeals: q.costDriverMeals || 0,
    costHotel: q.costHotel || 0,
    costMisc: q.costMisc || 0,
    refusedReason: q.refusedReason || '',
    requestReceivedAt: toDatetimeLocal(q.requestReceivedAt),
    requestChannel: q.requestChannel || q.source || 'email',
    proposedAt: toDateInput(q.proposedAt) || toDateInput(q.createdAt),
    validUntil: toDateInput(q.validUntil),
    acceptedAt: toDateInput(q.acceptedAt),
    announcedAt: toDateInput(q.announcedAt),
    invoicedAt: toDateInput(q.invoicedAt),
    dayDetails: q.dayDetails || '',
    internalNotes: q.internalNotes || '',
    lines:
      q.lines && q.lines.length > 0
        ? q.lines.map((l) => ({
            kind: l.kind,
            label: l.label,
            unit: l.unit,
            quantity: l.quantity,
            unitPriceHt: l.unitPriceHt,
          }))
        : [
            {
              kind: 'transport',
              label: q.title || 'Prestation transport',
              unit: 'forfait',
              quantity: 1,
              unitPriceHt: q.proposedPriceHt || q.amountHt || 0,
            },
          ],
  };
}

function buildPayload(form: FormState, status?: string) {
  const departureAt = combineDateTime(
    form.departureDate,
    form.departureTime || '08:00',
  );
  const returnAt = combineDateTime(
    form.returnDate,
    form.returnDepartureTime || '18:00',
  );
  const proposedAt = form.proposedAt
    ? combineDateTime(form.proposedAt, '12:00')
    : new Date().toISOString();
  const validUntil = form.validUntil
    ? combineDateTime(form.validUntil, '23:59')
    : addDaysIso(proposedAt!, 20);

  return {
    customerId: form.customerId,
    contactId: form.contactId || null,
    salespersonId: form.salespersonId || null,
    source: form.source,
    title:
      form.title.trim() ||
      [form.origin, form.destination].filter(Boolean).join(' → ') ||
      'Nouveau devis',
    description: form.description || null,
    caseType: form.caseType,
    origin: form.origin || null,
    originAddress: form.originAddress || null,
    destination: form.destination || null,
    destinationAddress: form.destinationAddress || null,
    departureAt,
    returnAt,
    garageDepartureAt: combineDateTime(
      form.departureDate,
      form.garageDepartureTime,
    ),
    presentationAt: combineDateTime(
      form.departureDate,
      form.presentationTime,
    ),
    onSiteAt: combineDateTime(form.departureDate, form.onSiteTime),
    returnDepartureAt: combineDateTime(
      form.returnDate,
      form.returnDepartureTime,
    ),
    returnGarageAt: combineDateTime(form.returnDate, form.returnGarageTime),
    vehicleCount: Number(form.vehicleCount) || 1,
    vehicleCategoryId: form.vehicleCategoryId || null,
    passengers: Number(form.passengers) || 0,
    amountHt: Number(form.amountHt) || 0,
    proposedPriceHt: Number(form.proposedPriceHt) || 0,
    vatRate: Number(form.vatRate) || 10,
    requestReceivedAt: form.requestReceivedAt
      ? new Date(form.requestReceivedAt).toISOString()
      : null,
    requestChannel: form.requestChannel || form.source,
    proposedAt,
    validUntil,
    acceptedAt: form.acceptedAt
      ? combineDateTime(form.acceptedAt, '12:00')
      : null,
    announcedAt: form.announcedAt
      ? combineDateTime(form.announcedAt, '12:00')
      : null,
    invoicedAt: form.invoicedAt
      ? combineDateTime(form.invoicedAt, '12:00')
      : null,
    dayDetails: form.dayDetails || null,
    internalNotes: form.internalNotes || null,
    serviceType: form.serviceType,
    distanceKm: form.distanceKm === '' ? null : Number(form.distanceKm),
    durationDays: Number(form.durationDays) || 1,
    depositPercent: Number(form.depositPercent) || 0,
    depositAmountHt: Number(form.depositAmountHt) || 0,
    customerPoNumber: form.customerPoNumber || null,
    billingEmail: form.billingEmail || null,
    luggageNotes: form.luggageNotes || null,
    accessibilityNotes: form.accessibilityNotes || null,
    optionsNotes: form.optionsNotes || null,
    costTolls: Number(form.costTolls) || 0,
    costParking: Number(form.costParking) || 0,
    costDriverMeals: Number(form.costDriverMeals) || 0,
    costHotel: Number(form.costHotel) || 0,
    costMisc: Number(form.costMisc) || 0,
    refusedReason: form.refusedReason || null,
    lines: form.lines.map((l) => ({
      kind: l.kind,
      label: l.label,
      unit: l.unit,
      quantity: Number(l.quantity) || 0,
      unitPriceHt: Number(l.unitPriceHt) || 0,
    })),
    ...(status ? { status } : {}),
  };
}

export function QuoteFiche({ quoteId }: { quoteId: string | 'new' }) {
  const router = useRouter();
  const isNew = quoteId === 'new';
  const [meta, setMeta] = useState<QuotesMeta | null>(null);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [tab, setTab] = useState<Tab>('resume');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [printTemplates, setPrintTemplates] = useState<
    Array<{ id: string; name: string; isDefault: boolean }>
  >([]);
  const [printTemplateId, setPrintTemplateId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api<QuotesMeta>('/quotes/meta');
        if (cancelled) return;
        setMeta(m);
        if (isNew) {
          const f = emptyForm(m);
          const primary = m.customers[0]?.contacts?.find((c) => c.isPrimary);
          if (primary) f.contactId = primary.id;
          setForm(f);
        } else {
          const q = await api<QuoteDetail>(`/quotes/${quoteId}`);
          if (cancelled) return;
          setQuote(q);
          setForm(fromQuote(q));
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId, isNew]);

  const contacts = useMemo(() => {
    if (!meta || !form) return [];
    return (
      meta.customers.find((c) => c.id === form.customerId)?.contacts || []
    );
  }, [meta, form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function onCategoryChange(categoryId: string) {
    if (!meta || !form) return;
    const cat = meta.categories.find((c) => c.id === categoryId);
    const seats = cat ? cat.defaultSeats * (form.vehicleCount || 1) : 0;
    setForm({
      ...form,
      vehicleCategoryId: categoryId,
      passengers: seats,
    });
  }

  function onVehicleCountChange(count: number) {
    if (!meta || !form) return;
    const cat = meta.categories.find((c) => c.id === form.vehicleCategoryId);
    const seats = cat ? cat.defaultSeats * Math.max(count, 1) : form.passengers;
    setForm({ ...form, vehicleCount: count, passengers: seats });
  }

  function onCustomerChange(customerId: string) {
    if (!meta || !form) return;
    const cust = meta.customers.find((c) => c.id === customerId);
    const primary = cust?.contacts?.find((c) => c.isPrimary) || cust?.contacts?.[0];
    setForm({
      ...form,
      customerId,
      contactId: primary?.id || '',
    });
  }

  function onProposedDateChange(date: string) {
    if (!form) return;
    setForm({
      ...form,
      proposedAt: date,
      validUntil: date
        ? toDateInput(addDaysIso(combineDateTime(date, '12:00')!, 20))
        : form.validUntil,
    });
  }

  async function save(status?: string) {
    if (!form) return;
    if (!form.customerId) {
      setErr('Sélectionnez un client');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const payload = buildPayload(form, status);
      if (isNew) {
        const created = await api<QuoteDetail>('/quotes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMsg(status === 'sent' ? 'Devis validé' : 'Brouillon enregistré');
        router.replace(`/app/quotes/${created.id}`);
      } else {
        const updated = await api<QuoteDetail>(`/quotes/${quoteId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setQuote(updated);
        setForm(fromQuote(updated));
        setMsg('Devis enregistré');
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function action(path: string, successMsg: string) {
    if (isNew) {
      setErr('Enregistrez d’abord le devis');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      // persist current form first
      await api(`/quotes/${quoteId}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPayload(form!)),
      });
      const updated = await api<QuoteDetail>(`/quotes/${quoteId}/${path}`, {
        method: 'POST',
        body: '{}',
      });
      setQuote(updated);
      setForm(fromQuote(updated));
      setMsg(successMsg);
      if (path === 'trash') router.push('/app/quotes');
      if (path === 'to-planning') router.push('/app/planning');
      if (path === 'to-billing') router.push('/app/billing');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openPrintDialog() {
    if (isNew) {
      setErr('Enregistrez d’abord le devis pour l’imprimer');
      return;
    }
    setErr('');
    try {
      const list = await api<
        Array<{ id: string; name: string; isDefault: boolean; kind: string }>
      >('/document-templates?kind=quote');
      const quotes = list.filter((t) => t.kind === 'quote');
      setPrintTemplates(quotes);
      const def = quotes.find((t) => t.isDefault) || quotes[0];
      setPrintTemplateId(def?.id || '');
      setPrintOpen(true);
    } catch (e) {
      // fallback: print with default server template
      try {
        await openPrintHtml(`/documents/print/quote/${quoteId}`);
      } catch (e2) {
        setErr((e2 as Error).message || (e as Error).message);
      }
    }
  }

  async function confirmPrint() {
    setBusy(true);
    setErr('');
    try {
      const q = printTemplateId
        ? `?templateId=${encodeURIComponent(printTemplateId)}`
        : '';
      await openPrintHtml(`/documents/print/quote/${quoteId}${q}`);
      setPrintOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !form) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
        {err}
      </div>
    );
  }

  if (!form || !meta) {
    return <div className="text-sm text-[var(--muted)]">Chargement…</div>;
  }

  const statusLabel = quote
    ? QUOTE_STATUS_LABELS[quote.status] || quote.status
    : 'Nouveau';

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Actions bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="flex items-start gap-3">
          <IconTile tone="blue">
            <IconFile />
          </IconTile>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">
                {isNew ? 'Nouveau devis' : quote?.number}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {statusLabel}
              </span>
              {quote?.publishedToPortal && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Espace client
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--muted)]">
              {quote?.title || 'Saisie du devis commercial'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/quotes" className="btn-secondary">
            Retour
          </Link>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={openPrintDialog}
          >
            Imprimer
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => save('draft')}
          >
            Brouillon
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => (isNew ? save('sent') : action('validate', 'Devis validé / proposé'))}
          >
            Valider
          </button>
          {!isNew && (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const copy = await api<QuoteDetail>(
                      `/quotes/${quoteId}/duplicate`,
                      { method: 'POST', body: '{}' },
                    );
                    router.push(`/app/quotes/${copy.id}`);
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Dupliquer
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => action('to-planning', 'Envoyé en planification')}
              >
                Planification
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => action('to-billing', 'Envoyé en facturation')}
              >
                Facturation
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || !!quote?.publishedToPortal}
                onClick={() =>
                  action('publish-portal', 'Publié sur l’espace client')
                }
              >
                Publier espace client
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={async () => {
                  const reason =
                    form.refusedReason ||
                    window.prompt('Motif de refus (optionnel)') ||
                    '';
                  setBusy(true);
                  try {
                    await api(`/quotes/${quoteId}`, {
                      method: 'PATCH',
                      body: JSON.stringify(buildPayload({ ...form, refusedReason: reason })),
                    });
                    const updated = await api<QuoteDetail>(
                      `/quotes/${quoteId}/refuse`,
                      {
                        method: 'POST',
                        body: JSON.stringify({ reason }),
                      },
                    );
                    setQuote(updated);
                    setForm(fromQuote(updated));
                    setMsg('Devis refusé');
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refuser
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                onClick={() => action('trash', 'Mis à la corbeille')}
              >
                Corbeille
              </button>
            </>
          )}
        </div>
      </div>

      {(msg || err) && (
        <div
          className={`print:hidden rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      {printOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md space-y-4 p-5 shadow-xl">
            <div>
              <h2 className="text-lg font-bold">Imprimer le devis</h2>
              <p className="text-sm text-[var(--muted)]">
                Choisissez le modèle d’impression. Vous pouvez les modifier dans
                Administration → Modèles d’impression.
              </p>
            </div>
            {printTemplates.length === 0 ? (
              <p className="text-sm text-amber-800">
                Aucun modèle trouvé — l’impression utilisera le modèle système.
              </p>
            ) : (
              <div className="space-y-2">
                {printTemplates.map((t) => (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                      printTemplateId === t.id
                        ? 'border-action bg-action/5'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="print-template"
                      checked={printTemplateId === t.id}
                      onChange={() => setPrintTemplateId(t.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{t.name}</span>
                      {t.isDefault && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          Modèle par défaut
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <Link
                href="/app/admin/templates"
                className="btn-ghost text-sm text-action"
              >
                Modifier les modèles…
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPrintOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={confirmPrint}
                >
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header client / commercial */}
      <section className="card grid gap-3 p-4 md:grid-cols-4">
        <div>
          <label className="label">Client</label>
          <select
            className="input"
            value={form.customerId}
            onChange={(e) => onCustomerChange(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {meta.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Contact</label>
          <select
            className="input"
            value={form.contactId}
            onChange={(e) => setField('contactId', e.target.value)}
          >
            <option value="">— Aucun —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
                {c.isPrimary ? ' (principal)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Commercial</label>
          <select
            className="input"
            value={form.salespersonId}
            onChange={(e) => setField('salespersonId', e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {meta.salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Source devis</label>
          <select
            className="input"
            value={form.source}
            onChange={(e) => {
              setField('source', e.target.value);
              setField('requestChannel', e.target.value);
            }}
          >
            {QUOTE_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Tabs */}
      <div className="print:hidden flex flex-wrap gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-b-2 border-action text-action'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        {tab === 'resume' && (
          <div className="space-y-4">
            <section className="card space-y-4 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <IconTile tone="emerald" className="!h-8 !w-8">
                  <IconMap size={14} />
                </IconTile>
                Trajet & description
              </div>
              <div>
                <label className="label">Destination / objet</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="Ex. Sortie scolaire Annecy"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[72px]"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Précisions du trajet, contraintes…"
                />
              </div>
            </section>

            <section className="card space-y-4 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <IconTile tone="cyan" className="!h-8 !w-8">
                  <IconCalendar size={14} />
                </IconTile>
                Aller — horaires
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="label">Date de départ</label>
                  <input
                    className="input"
                    type="date"
                    value={form.departureDate}
                    onChange={(e) => setField('departureDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Départ garage</label>
                  <input
                    className="input"
                    type="time"
                    value={form.garageDepartureTime}
                    onChange={(e) =>
                      setField('garageDepartureTime', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="label">Présentation sur lieu</label>
                  <input
                    className="input"
                    type="time"
                    value={form.presentationTime}
                    onChange={(e) =>
                      setField('presentationTime', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="label">Heure de départ</label>
                  <input
                    className="input"
                    type="time"
                    value={form.departureTime}
                    onChange={(e) => setField('departureTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Sur place</label>
                  <input
                    className="input"
                    type="time"
                    value={form.onSiteTime}
                    onChange={(e) => setField('onSiteTime', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">De quelle destination (lieu)</label>
                  <input
                    className="input"
                    value={form.origin}
                    onChange={(e) => setField('origin', e.target.value)}
                    placeholder="Lieu de prise en charge"
                  />
                </div>
                <div>
                  <label className="label">Adresse</label>
                  <input
                    className="input"
                    value={form.originAddress}
                    onChange={(e) => setField('originAddress', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Vers quelle destination</label>
                  <input
                    className="input"
                    value={form.destination}
                    onChange={(e) => setField('destination', e.target.value)}
                    placeholder="Lieu d’arrivée"
                  />
                </div>
                <div>
                  <label className="label">Adresse</label>
                  <input
                    className="input"
                    value={form.destinationAddress}
                    onChange={(e) =>
                      setField('destinationAddress', e.target.value)
                    }
                  />
                </div>
              </div>
            </section>

            <section className="card space-y-4 p-4">
              <div className="text-sm font-semibold">Retour — horaires</div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="label">Date de retour</label>
                  <input
                    className="input"
                    type="date"
                    value={form.returnDate}
                    onChange={(e) => setField('returnDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Départ / heure de retour</label>
                  <input
                    className="input"
                    type="time"
                    value={form.returnDepartureTime}
                    onChange={(e) =>
                      setField('returnDepartureTime', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="label">Retour garage</label>
                  <input
                    className="input"
                    type="time"
                    value={form.returnGarageTime}
                    onChange={(e) =>
                      setField('returnGarageTime', e.target.value)
                    }
                  />
                </div>
              </div>
            </section>

            <section className="card space-y-4 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <IconTile tone="amber" className="!h-8 !w-8">
                  <IconSettings size={14} />
                </IconTile>
                Flotte & tarification
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="label">Nombre de cars</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.vehicleCount}
                    onChange={(e) =>
                      onVehicleCountChange(Number(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <label className="label">Type de car</label>
                  <select
                    className="input"
                    value={form.vehicleCategoryId}
                    onChange={(e) => onCategoryChange(e.target.value)}
                  >
                    <option value="">— Catégorie —</option>
                    {meta.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.defaultSeats} pl.)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Passagers</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.passengers}
                    onChange={(e) =>
                      setField('passengers', Number(e.target.value) || 0)
                    }
                  />
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Auto selon type × nb cars
                  </p>
                </div>
                <div>
                  <label className="label">Type de prestation</label>
                  <select
                    className="input"
                    value={form.serviceType}
                    onChange={(e) => setField('serviceType', e.target.value)}
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Type dossier</label>
                  <select
                    className="input"
                    value={form.caseType}
                    onChange={(e) => setField('caseType', e.target.value)}
                  >
                    <option value="simple">Simple</option>
                    <option value="transfer">Transfert A/R</option>
                    <option value="repetitive">Répétitif</option>
                    <option value="complex">Complexe</option>
                  </select>
                </div>
                <div>
                  <label className="label">Distance estimée (km)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.distanceKm}
                    onChange={(e) =>
                      setField(
                        'distanceKm',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                  />
                </div>
                <div>
                  <label className="label">Durée (jours)</label>
                  <input
                    className="input"
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={form.durationDays}
                    onChange={(e) =>
                      setField('durationDays', Number(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <label className="label">Prix HT</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.amountHt}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setForm({
                        ...form,
                        amountHt: v,
                        proposedPriceHt:
                          form.proposedPriceHt === form.amountHt
                            ? v
                            : form.proposedPriceHt,
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="label">Prix proposé HT</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.proposedPriceHt}
                    onChange={(e) =>
                      setField('proposedPriceHt', Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className="label">TVA %</label>
                  <input
                    className="input"
                    type="number"
                    value={form.vatRate}
                    onChange={(e) =>
                      setField('vatRate', Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm">
                    TTC estimé{' '}
                    <strong>
                      {formatMoney(
                        (form.proposedPriceHt || form.amountHt) *
                          (1 + form.vatRate / 100),
                      )}
                    </strong>
                  </div>
                </div>
              </div>
              {quote?.availabilityNote && (
                <p className="text-xs text-action">{quote.availabilityNote}</p>
              )}
            </section>

            <section className="card space-y-4 p-4">
              <div className="text-sm font-semibold">Suivi commercial</div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="label">Demande réceptionnée le</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.requestReceivedAt}
                    onChange={(e) =>
                      setField('requestReceivedAt', e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="label">Par</label>
                  <select
                    className="input"
                    value={form.requestChannel}
                    onChange={(e) => setField('requestChannel', e.target.value)}
                  >
                    {QUOTE_SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Devis proposé le</label>
                  <input
                    className="input"
                    type="date"
                    value={form.proposedAt}
                    onChange={(e) => onProposedDateChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Fin de validité (20 j)</label>
                  <input
                    className="input"
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setField('validUntil', e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'lines' && (
          <div className="space-y-4">
            <section className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Lignes de devis</div>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() =>
                    setField('lines', [
                      ...form.lines,
                      {
                        kind: 'option',
                        label: '',
                        unit: 'forfait',
                        quantity: 1,
                        unitPriceHt: 0,
                      },
                    ])
                  }
                >
                  + Ligne
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Libellé</th>
                      <th className="px-2 py-2 text-left">Unité</th>
                      <th className="px-2 py-2 text-right">Qté</th>
                      <th className="px-2 py-2 text-right">P.U. HT</th>
                      <th className="px-2 py-2 text-right">Montant</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((line, idx) => (
                      <tr key={idx} className="border-t border-[var(--border)]">
                        <td className="px-2 py-2">
                          <select
                            className="input"
                            value={line.kind}
                            onChange={(e) => {
                              const lines = [...form.lines];
                              lines[idx] = { ...line, kind: e.target.value };
                              setField('lines', lines);
                            }}
                          >
                            {LINE_KINDS.map((k) => (
                              <option key={k.value} value={k.value}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input"
                            value={line.label}
                            onChange={(e) => {
                              const lines = [...form.lines];
                              lines[idx] = { ...line, label: e.target.value };
                              setField('lines', lines);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            className="input"
                            value={line.unit}
                            onChange={(e) => {
                              const lines = [...form.lines];
                              lines[idx] = { ...line, unit: e.target.value };
                              setField('lines', lines);
                            }}
                          >
                            {LINE_UNITS.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input text-right"
                            type="number"
                            min={0}
                            step={0.5}
                            value={line.quantity}
                            onChange={(e) => {
                              const lines = [...form.lines];
                              lines[idx] = {
                                ...line,
                                quantity: Number(e.target.value) || 0,
                              };
                              setField('lines', lines);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className="input text-right"
                            type="number"
                            step={0.01}
                            value={line.unitPriceHt}
                            onChange={(e) => {
                              const lines = [...form.lines];
                              lines[idx] = {
                                ...line,
                                unitPriceHt: Number(e.target.value) || 0,
                              };
                              setField('lines', lines);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-medium">
                          {formatMoney(lineAmount(line))}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="btn-ghost text-danger text-xs"
                            disabled={form.lines.length <= 1}
                            onClick={() =>
                              setField(
                                'lines',
                                form.lines.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                <p className="text-sm text-[var(--muted)]">
                  Total lignes :{' '}
                  <strong>
                    {formatMoney(
                      form.lines.reduce((s, l) => s + lineAmount(l), 0),
                    )}
                  </strong>
                </p>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    const sum = form.lines.reduce(
                      (s, l) => s + lineAmount(l),
                      0,
                    );
                    setForm({
                      ...form,
                      amountHt: sum,
                      proposedPriceHt: sum,
                      depositAmountHt:
                        Math.round(
                          sum * ((form.depositPercent || 0) / 100) * 100,
                        ) / 100,
                    });
                  }}
                >
                  Recalculer le prix depuis les lignes
                </button>
              </div>
            </section>

            <section className="card space-y-3 p-4">
              <div className="text-sm font-semibold">
                Coûts internes (non facturés au client)
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                {(
                  [
                    ['costTolls', 'Péages'],
                    ['costParking', 'Parking'],
                    ['costDriverMeals', 'Repas chauffeur'],
                    ['costHotel', 'Hôtel'],
                    ['costMisc', 'Divers'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step={0.01}
                      value={form[key]}
                      onChange={(e) =>
                        setField(key, Number(e.target.value) || 0)
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'options' && (
          <section className="card grid gap-3 p-4 md:grid-cols-2">
            <div>
              <label className="label">N° bon de commande client</label>
              <input
                className="input"
                value={form.customerPoNumber}
                onChange={(e) => setField('customerPoNumber', e.target.value)}
                placeholder="BC-…"
              />
            </div>
            <div>
              <label className="label">E-mail facturation</label>
              <input
                className="input"
                type="email"
                value={form.billingEmail}
                onChange={(e) => setField('billingEmail', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Acompte (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={form.depositPercent}
                onChange={(e) => {
                  const depositPercent = Number(e.target.value) || 0;
                  setForm({
                    ...form,
                    depositPercent,
                    depositAmountHt:
                      Math.round(
                        (form.proposedPriceHt || form.amountHt) *
                          (depositPercent / 100) *
                          100,
                      ) / 100,
                  });
                }}
              />
            </div>
            <div>
              <label className="label">Acompte HT (€)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.01}
                value={form.depositAmountHt}
                onChange={(e) =>
                  setField('depositAmountHt', Number(e.target.value) || 0)
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Bagages / équipements</label>
              <textarea
                className="input min-h-[72px]"
                value={form.luggageNotes}
                onChange={(e) => setField('luggageNotes', e.target.value)}
                placeholder="Soute, remorque, vélos…"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Accessibilité PMR</label>
              <textarea
                className="input min-h-[72px]"
                value={form.accessibilityNotes}
                onChange={(e) =>
                  setField('accessibilityNotes', e.target.value)
                }
                placeholder="Rampe, places PMR, accompagnement…"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Options (Wi‑Fi, toilettes, frigo…)</label>
              <textarea
                className="input min-h-[72px]"
                value={form.optionsNotes}
                onChange={(e) => setField('optionsNotes', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Motif de refus (si applicable)</label>
              <input
                className="input"
                value={form.refusedReason}
                onChange={(e) => setField('refusedReason', e.target.value)}
              />
            </div>
          </section>
        )}

        {tab === 'accept' && (
          <section className="card grid gap-3 p-4 md:grid-cols-3">
            <div>
              <label className="label">Accepté le</label>
              <input
                className="input"
                type="date"
                value={form.acceptedAt}
                onChange={(e) => setField('acceptedAt', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Annoncé le</label>
              <input
                className="input"
                type="date"
                value={form.announcedAt}
                onChange={(e) => setField('announcedAt', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Facturé le</label>
              <input
                className="input"
                type="date"
                value={form.invoicedAt}
                onChange={(e) => setField('invoicedAt', e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-2 print:hidden">
              <button
                type="button"
                className="btn-primary"
                disabled={busy || isNew}
                onClick={() => action('accept', 'Devis accepté → commande')}
              >
                Marquer accepté → commande
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || isNew}
                onClick={() => action('to-planning', 'Planification')}
              >
                Passer en planification
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || isNew}
                onClick={() => action('to-billing', 'Facturation')}
              >
                Passer en facturation
              </button>
            </div>
          </section>
        )}

        {tab === 'destination' && (
          <section className="card grid gap-3 p-4 md:grid-cols-2">
            <div>
              <label className="label">Lieu de départ</label>
              <input
                className="input"
                value={form.origin}
                onChange={(e) => setField('origin', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Adresse départ</label>
              <input
                className="input"
                value={form.originAddress}
                onChange={(e) => setField('originAddress', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Lieu d’arrivée</label>
              <input
                className="input"
                value={form.destination}
                onChange={(e) => setField('destination', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Adresse arrivée</label>
              <input
                className="input"
                value={form.destinationAddress}
                onChange={(e) =>
                  setField('destinationAddress', e.target.value)
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description du trajet</label>
              <textarea
                className="input min-h-[100px]"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>
          </section>
        )}

        {tab === 'days' && (
          <section className="card p-4">
            <label className="label">Détails jours de vie / itinéraire</label>
            <textarea
              className="input min-h-[220px]"
              value={form.dayDetails}
              onChange={(e) => setField('dayDetails', e.target.value)}
              placeholder="Jour 1 : …&#10;Jour 2 : …"
            />
          </section>
        )}

        {tab === 'notes' && (
          <section className="card p-4">
            <label className="label">Notes internes (non visibles client)</label>
            <textarea
              className="input min-h-[220px]"
              value={form.internalNotes}
              onChange={(e) => setField('internalNotes', e.target.value)}
            />
          </section>
        )}

        <div className="print:hidden flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => save('draft')}
          >
            Enregistrer brouillon
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
