'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  IconBuilding,
  IconFile,
  IconId,
  IconInvoice,
  IconMap,
  IconPlus,
  IconSettings,
  IconTile,
  IconUsers,
} from '@/components/Icons';
import {
  CUSTOMER_TYPES,
  CustomerDetail,
  DOC_CATEGORIES,
  PAYMENT_TERMS,
} from '@/lib/customer';
import { SEPA_STATUS } from '@/lib/commercial';
import { readImageAsDataUrl } from '@/lib/branding';

type Tab =
  | 'general'
  | 'contacts'
  | 'billing'
  | 'destinations'
  | 'documents'
  | 'comments'
  | 'rib';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'Généralités' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'billing', label: 'Facturation' },
  { id: 'destinations', label: 'Destinations' },
  { id: 'documents', label: 'Documents' },
  { id: 'comments', label: 'Commentaires' },
  { id: 'rib', label: 'Paramétrage RIB' },
];

function emptyGeneral(c: CustomerDetail) {
  return {
    reference: c.reference || '',
    name: c.name || '',
    tradeName: c.tradeName || '',
    type: c.type || 'enterprise',
    siret: c.siret || '',
    vatNumber: c.vatNumber || '',
    email: c.email || '',
    phone: c.phone || '',
    mobile: c.mobile || '',
    website: c.website || '',
    addressLine1: c.addressLine1 || '',
    addressLine2: c.addressLine2 || '',
    postalCode: c.postalCode || '',
    city: c.city || '',
    country: c.country || 'France',
    paymentTermsDays: c.paymentTermsDays || 30,
    paymentMethod: c.paymentMethod || 'transfer',
    creditLimit: c.creditLimit ?? '',
    currency: c.currency || 'EUR',
    alertNote: c.alertNote || '',
    notes: c.notes || '',
    internalRemarks: c.internalRemarks || '',
    preferredVehicleNotes: c.preferredVehicleNotes || '',
    preferredDriverNotes: c.preferredDriverNotes || '',
    billingSameAsMain: c.billingSameAsMain !== false,
    billingAddressLine1: c.billingAddressLine1 || '',
    billingAddressLine2: c.billingAddressLine2 || '',
    billingPostalCode: c.billingPostalCode || '',
    billingCity: c.billingCity || '',
    billingCountry: c.billingCountry || 'France',
    accountManagerId: c.accountManagerId || '',
    apeCode: c.apeCode || '',
    invoiceEmail: c.invoiceEmail || '',
    requirePurchaseOrder: c.requirePurchaseOrder === true,
    latePenaltyRate: c.latePenaltyRate ?? 10,
    earlyDiscountRate: c.earlyDiscountRate ?? 0,
    sepaMandateStatus: c.sepaMandateStatus || 'none',
    contractRef: c.contractRef || '',
    contractEndsAt: c.contractEndsAt ? c.contractEndsAt.slice(0, 10) : '',
    pricingNotes: c.pricingNotes || '',
  };
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof emptyGeneral> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [contactForm, setContactForm] = useState({
    civility: 'M.',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    role: '',
    department: '',
    isPrimary: false,
    isBilling: false,
    isOps: false,
  });
  const [destForm, setDestForm] = useState({
    label: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    country: 'France',
    notes: '',
  });
  const [bankForm, setBankForm] = useState({
    label: 'Principal',
    bankName: '',
    iban: '',
    bic: '',
    accountHolder: '',
    rum: '',
  });
  const [commentBody, setCommentBody] = useState('');

  const load = useCallback(async () => {
    const data = await api<CustomerDetail>(`/customers/${id}`);
    setC(data);
    setForm(emptyGeneral(data));
  }, [id]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function saveGeneral(e?: FormEvent) {
    e?.preventDefault();
    if (!form) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const updated = await api<CustomerDetail>(`/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          accountManagerId: form.accountManagerId || null,
          creditLimit:
            form.creditLimit === '' || form.creditLimit === null
              ? null
              : Number(form.creditLimit),
          paymentTermsDays: Number(form.paymentTermsDays),
          latePenaltyRate: Number(form.latePenaltyRate) || 0,
          earlyDiscountRate: Number(form.earlyDiscountRate) || 0,
          contractEndsAt: form.contractEndsAt || null,
        }),
      });
      setC(updated);
      setForm(emptyGeneral(updated));
      setEditing(false);
      setMsg('Fiche enregistrée.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomer() {
    if (!confirm('Archiver / supprimer ce client ?')) return;
    setBusy(true);
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      router.push('/app/customers');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  function printFiche() {
    window.print();
  }

  function mailFiche() {
    if (!c) return;
    const subject = encodeURIComponent(`Fiche client ${c.reference || ''} — ${c.name}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver les informations du client ${c.name}.\nRéférence : ${c.reference || '—'}\nEmail : ${c.email || '—'}\nTéléphone : ${c.phone || '—'}\n\nCordialement.`,
    );
    window.location.href = `mailto:${c.email || ''}?subject=${subject}&body=${body}`;
  }

  if (err && !c) return <p className="text-danger">{err}</p>;
  if (!c || !form) return <p className="text-[var(--muted)]">Chargement de la fiche…</p>;

  const typeLabel =
    CUSTOMER_TYPES.find((t) => t.value === c.type)?.label || c.type;
  const disabled = !editing;

  return (
    <div className="mx-auto max-w-6xl space-y-4 print:max-w-none">
      {/* Barre d’actions sticky */}
      <div className="card sticky top-0 z-20 space-y-3 p-4 print:static print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IconTile tone="teal" className="h-12 w-12">
              <IconBuilding size={22} />
            </IconTile>
            <div>
              <Link
                href="/app/customers"
                className="text-xs font-semibold text-action hover:underline print:hidden"
              >
                ← Clients
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{c.name}</h1>
                {c.reference && (
                  <span className="rounded-lg bg-night/5 px-2 py-0.5 font-mono text-xs text-[var(--muted)]">
                    {c.reference}
                  </span>
                )}
                <span className="badge-teal">{typeLabel}</span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                {[c.city, c.country].filter(Boolean).join(' · ') || 'Adresse non renseignée'}
                {c.email ? ` · ${c.email}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {!editing ? (
              <button className="btn-primary" onClick={() => setEditing(true)}>
                Modifier
              </button>
            ) : (
              <>
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => saveGeneral()}
                >
                  Enregistrer
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setForm(emptyGeneral(c));
                    setEditing(false);
                  }}
                >
                  Annuler
                </button>
              </>
            )}
            <button className="btn-secondary" onClick={printFiche}>
              Imprimer
            </button>
            <button className="btn-secondary" onClick={mailFiche}>
              Envoyer par mail
            </button>
            <button className="btn-danger" disabled={busy} onClick={removeCustomer}>
              Supprimer
            </button>
          </div>
        </div>

        {c.alertNote && (
          <div className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
            <strong>Alerte :</strong> {c.alertNote}
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-t border-[var(--border)] pt-3 print:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-action text-white'
                  : 'text-[var(--muted)] hover:bg-night/5 hover:text-night'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {(msg || err) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            err ? 'bg-danger/10 text-danger' : 'bg-ok/10 text-ok'
          }`}
        >
          {err || msg}
        </p>
      )}

      {/* Généralités */}
      {tab === 'general' && (
        <form onSubmit={saveGeneral} className="space-y-4">
          <div className="card grid gap-4 p-5 md:grid-cols-3">
            <div>
              <label className="label">Référence</label>
              <input
                className="input font-mono"
                disabled={disabled}
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Raison sociale</label>
              <input
                className="input"
                disabled={disabled}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Enseigne</label>
              <input
                className="input"
                disabled={disabled}
                value={form.tradeName}
                onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                disabled={disabled}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Échéance factures</label>
              <select
                className="input"
                disabled={disabled}
                value={form.paymentTermsDays}
                onChange={(e) =>
                  setForm({ ...form, paymentTermsDays: Number(e.target.value) })
                }
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">SIRET</label>
              <input
                className="input"
                disabled={disabled}
                value={form.siret}
                onChange={(e) => setForm({ ...form, siret: e.target.value })}
              />
            </div>
            <div>
              <label className="label">N° TVA</label>
              <input
                className="input"
                disabled={disabled}
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input
                className="input"
                disabled={disabled}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input
                className="input"
                disabled={disabled}
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                disabled={disabled}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Site web</label>
              <input
                className="input"
                disabled={disabled}
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
          </div>

          <div className="card grid gap-4 p-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <h3 className="mb-2 font-semibold">Adresse</h3>
            </div>
            <div className="md:col-span-2">
              <label className="label">Adresse</label>
              <input
                className="input"
                disabled={disabled}
                value={form.addressLine1}
                onChange={(e) =>
                  setForm({ ...form, addressLine1: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Complément</label>
              <input
                className="input"
                disabled={disabled}
                value={form.addressLine2}
                onChange={(e) =>
                  setForm({ ...form, addressLine2: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Code postal</label>
              <input
                className="input"
                disabled={disabled}
                value={form.postalCode}
                onChange={(e) =>
                  setForm({ ...form, postalCode: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Ville</label>
              <input
                className="input"
                disabled={disabled}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Pays</label>
              <input
                className="input"
                disabled={disabled}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <label className="label">Champ alerte</label>
            <textarea
              className="input min-h-[72px]"
              disabled={disabled}
              placeholder="Message d’alerte affiché en haut de la fiche…"
              value={form.alertNote}
              onChange={(e) => setForm({ ...form, alertNote: e.target.value })}
            />
            <label className="label">Notes / remarques</label>
            <textarea
              className="input min-h-[100px]"
              disabled={disabled}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Préférences véhicule</label>
                <textarea
                  className="input min-h-[72px]"
                  disabled={disabled}
                  value={form.preferredVehicleNotes}
                  onChange={(e) =>
                    setForm({ ...form, preferredVehicleNotes: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Préférences conducteur</label>
                <textarea
                  className="input min-h-[72px]"
                  disabled={disabled}
                  value={form.preferredDriverNotes}
                  onChange={(e) =>
                    setForm({ ...form, preferredDriverNotes: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {editing && (
            <button className="btn-primary" disabled={busy}>
              Enregistrer les généralités
            </button>
          )}
        </form>
      )}

      {/* Contacts */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Coordonnées</th>
                  <th className="px-4 py-3">Rôles</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {c.contacts.map((ct) => (
                  <tr key={ct.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {ct.civility ? `${ct.civility} ` : ''}
                        {ct.firstName} {ct.lastName}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {[ct.role, ct.department].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{ct.email || '—'}</div>
                      <div className="text-[var(--muted)]">
                        {[ct.phone, ct.mobile].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ct.isPrimary && <span className="badge-blue">Principal</span>}
                        {ct.isBilling && <span className="badge-warn">Facturation</span>}
                        {ct.isOps && <span className="badge-teal">Exploitation</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="btn-ghost text-danger"
                        onClick={async () => {
                          await api(`/customers/${id}/contacts/${ct.id}`, {
                            method: 'DELETE',
                          });
                          await load();
                        }}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
                {c.contacts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                      Aucun contact
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            className="card grid gap-3 p-4 md:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/customers/${id}/contacts`, {
                method: 'POST',
                body: JSON.stringify(contactForm),
              });
              setContactForm({
                civility: 'M.',
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                mobile: '',
                role: '',
                department: '',
                isPrimary: false,
                isBilling: false,
                isOps: false,
              });
              await load();
              setMsg('Contact ajouté.');
            }}
          >
            <h3 className="md:col-span-3 flex items-center gap-2 font-semibold">
              <IconUsers size={16} /> Ajouter un contact
            </h3>
            <div>
              <label className="label">Civilité</label>
              <select
                className="input"
                value={contactForm.civility}
                onChange={(e) =>
                  setContactForm({ ...contactForm, civility: e.target.value })
                }
              >
                <option>M.</option>
                <option>Mme</option>
                <option>Mx</option>
              </select>
            </div>
            <div>
              <label className="label">Prénom</label>
              <input
                className="input"
                required
                value={contactForm.firstName}
                onChange={(e) =>
                  setContactForm({ ...contactForm, firstName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Nom</label>
              <input
                className="input"
                required
                value={contactForm.lastName}
                onChange={(e) =>
                  setContactForm({ ...contactForm, lastName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                value={contactForm.email}
                onChange={(e) =>
                  setContactForm({ ...contactForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input
                className="input"
                value={contactForm.phone}
                onChange={(e) =>
                  setContactForm({ ...contactForm, phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Fonction</label>
              <input
                className="input"
                value={contactForm.role}
                onChange={(e) =>
                  setContactForm({ ...contactForm, role: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactForm.isPrimary}
                  onChange={(e) =>
                    setContactForm({
                      ...contactForm,
                      isPrimary: e.target.checked,
                    })
                  }
                />
                Principal
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactForm.isBilling}
                  onChange={(e) =>
                    setContactForm({
                      ...contactForm,
                      isBilling: e.target.checked,
                    })
                  }
                />
                Facturation
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactForm.isOps}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, isOps: e.target.checked })
                  }
                />
                Exploitation
              </label>
            </div>
            <button className="btn-primary md:col-span-3">
              <IconPlus size={16} /> Ajouter
            </button>
          </form>
        </div>
      )}

      {/* Facturation / adresse */}
      {tab === 'billing' && (
        <form onSubmit={saveGeneral} className="card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <IconTile tone="amber">
              <IconInvoice size={18} />
            </IconTile>
            <div>
              <h3 className="font-semibold">Adresse de facturation</h3>
              <p className="text-sm text-[var(--muted)]">
                Distincte de l’adresse principale si besoin.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={form.billingSameAsMain}
              onChange={(e) =>
                setForm({ ...form, billingSameAsMain: e.target.checked })
              }
            />
            Identique à l’adresse principale
          </label>
          {!form.billingSameAsMain && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">Adresse</label>
                <input
                  className="input"
                  disabled={disabled}
                  value={form.billingAddressLine1}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      billingAddressLine1: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Code postal</label>
                <input
                  className="input"
                  disabled={disabled}
                  value={form.billingPostalCode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      billingPostalCode: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">Ville</label>
                <input
                  className="input"
                  disabled={disabled}
                  value={form.billingCity}
                  onChange={(e) =>
                    setForm({ ...form, billingCity: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Pays</label>
                <input
                  className="input"
                  disabled={disabled}
                  value={form.billingCountry}
                  onChange={(e) =>
                    setForm({ ...form, billingCountry: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Échéance</label>
              <select
                className="input"
                disabled={disabled}
                value={form.paymentTermsDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    paymentTermsDays: Number(e.target.value),
                  })
                }
              >
                {PAYMENT_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Mode de règlement</label>
              <select
                className="input"
                disabled={disabled}
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value })
                }
              >
                <option value="transfer">Virement</option>
                <option value="check">Chèque</option>
                <option value="card">Carte</option>
                <option value="direct_debit">Prélèvement</option>
                <option value="cash">Espèces</option>
              </select>
            </div>
            <div>
              <label className="label">Plafond crédit (€)</label>
              <input
                className="input"
                type="number"
                disabled={disabled}
                value={form.creditLimit}
                onChange={(e) =>
                  setForm({ ...form, creditLimit: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">E-mail facturation</label>
              <input
                className="input"
                type="email"
                disabled={disabled}
                value={form.invoiceEmail}
                onChange={(e) =>
                  setForm({ ...form, invoiceEmail: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Code APE / NAF</label>
              <input
                className="input"
                disabled={disabled}
                value={form.apeCode}
                onChange={(e) => setForm({ ...form, apeCode: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Mandat SEPA</label>
              <select
                className="input"
                disabled={disabled}
                value={form.sepaMandateStatus}
                onChange={(e) =>
                  setForm({ ...form, sepaMandateStatus: e.target.value })
                }
              >
                {SEPA_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">N° marché / convention</label>
              <input
                className="input"
                disabled={disabled}
                value={form.contractRef}
                onChange={(e) =>
                  setForm({ ...form, contractRef: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Fin de contrat</label>
              <input
                className="input"
                type="date"
                disabled={disabled}
                value={form.contractEndsAt}
                onChange={(e) =>
                  setForm({ ...form, contractEndsAt: e.target.value })
                }
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={form.requirePurchaseOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      requirePurchaseOrder: e.target.checked,
                    })
                  }
                />
                BC client obligatoire
              </label>
            </div>
            <div>
              <label className="label">Pénalités de retard (% / an)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.1}
                disabled={disabled}
                value={form.latePenaltyRate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    latePenaltyRate: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className="label">Escompte anticipé (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.1}
                disabled={disabled}
                value={form.earlyDiscountRate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    earlyDiscountRate: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="md:col-span-3">
              <label className="label">Notes tarifaires / grille négociée</label>
              <textarea
                className="input min-h-[72px]"
                disabled={disabled}
                value={form.pricingNotes}
                onChange={(e) =>
                  setForm({ ...form, pricingNotes: e.target.value })
                }
              />
            </div>
          </div>

          {editing && (
            <button className="btn-primary" disabled={busy}>
              Enregistrer
            </button>
          )}
          {!editing && (
            <p className="text-xs text-[var(--muted)]">
              Cliquez sur <strong>Modifier</strong> en haut pour éditer.
            </p>
          )}
        </form>
      )}

      {/* Destinations */}
      {tab === 'destinations' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {c.destinations.map((d) => (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2">
                    <IconTile tone="cyan" className="h-9 w-9">
                      <IconMap size={16} />
                    </IconTile>
                    <div>
                      <div className="font-semibold">{d.label}</div>
                      <div className="text-sm text-[var(--muted)]">
                        {[d.addressLine1, d.postalCode, d.city, d.country]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </div>
                      {d.notes && (
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {d.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn-ghost text-danger text-xs"
                    onClick={async () => {
                      await api(`/customers/${id}/destinations/${d.id}`, {
                        method: 'DELETE',
                      });
                      await load();
                    }}
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {c.tripHistory?.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-3 font-semibold">Historique des trajets (devis)</h3>
              <ul className="space-y-2 text-sm">
                {c.tripHistory.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {t.origin || '?'} → {t.destination || '?'}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {t.number} · {t.title}
                      </div>
                    </div>
                    <span className="badge-blue">{t.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            className="card grid gap-3 p-4 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/customers/${id}/destinations`, {
                method: 'POST',
                body: JSON.stringify(destForm),
              });
              setDestForm({
                label: '',
                addressLine1: '',
                postalCode: '',
                city: '',
                country: 'France',
                notes: '',
              });
              await load();
            }}
          >
            <h3 className="md:col-span-2 font-semibold">Ajouter une destination</h3>
            <div>
              <label className="label">Libellé</label>
              <input
                className="input"
                required
                value={destForm.label}
                onChange={(e) =>
                  setDestForm({ ...destForm, label: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                className="input"
                value={destForm.addressLine1}
                onChange={(e) =>
                  setDestForm({ ...destForm, addressLine1: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Code postal</label>
              <input
                className="input"
                value={destForm.postalCode}
                onChange={(e) =>
                  setDestForm({ ...destForm, postalCode: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Ville</label>
              <input
                className="input"
                value={destForm.city}
                onChange={(e) =>
                  setDestForm({ ...destForm, city: e.target.value })
                }
              />
            </div>
            <button className="btn-primary md:col-span-2">
              <IconPlus size={16} /> Ajouter
            </button>
          </form>
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-night/5 text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {c.documents.map((d) => (
                  <tr key={d.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {d.fileName || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {DOC_CATEGORIES.find((x) => x.value === d.category)?.label ||
                        d.category}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {new Date(d.uploadedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.fileUrl && (
                        <a
                          className="btn-ghost text-action"
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ouvrir
                        </a>
                      )}
                      <button
                        className="btn-ghost text-danger"
                        onClick={async () => {
                          await api(`/customers/${id}/documents/${d.id}`, {
                            method: 'DELETE',
                          });
                          await load();
                        }}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
                {c.documents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                      Aucun document associé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            className="card grid gap-3 p-4 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = String(fd.get('name') || '');
              const category = String(fd.get('category') || 'autre');
              const file = (fd.get('file') as File) || null;
              let fileUrl: string | null = null;
              let fileName: string | null = null;
              let mimeType: string | null = null;
              if (file && file.size > 0) {
                fileUrl = await readImageAsDataUrl(file).catch(async () => {
                  // allow non-images via FileReader too
                  return new Promise<string>((resolve, reject) => {
                    if (file.size > 1.5 * 1024 * 1024) {
                      reject(new Error('Fichier trop lourd (max 1,5 Mo)'));
                      return;
                    }
                    const r = new FileReader();
                    r.onload = () => resolve(String(r.result));
                    r.onerror = () => reject(new Error('Lecture impossible'));
                    r.readAsDataURL(file);
                  });
                });
                fileName = file.name;
                mimeType = file.type;
              }
              await api(`/customers/${id}/documents`, {
                method: 'POST',
                body: JSON.stringify({ name, category, fileUrl, fileName, mimeType }),
              });
              e.currentTarget.reset();
              await load();
              setMsg('Document associé.');
            }}
          >
            <h3 className="md:col-span-2 flex items-center gap-2 font-semibold">
              <IconFile size={16} /> Associer un document
            </h3>
            <div>
              <label className="label">Nom</label>
              <input className="input" name="name" required />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" name="category" defaultValue="autre">
                {DOC_CATEGORIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Fichier (max 1,5 Mo)</label>
              <input className="block text-sm" type="file" name="file" />
            </div>
            <button className="btn-primary md:col-span-2">
              <IconPlus size={16} /> Ajouter
            </button>
          </form>
        </div>
      )}

      {/* Commentaires */}
      {tab === 'comments' && (
        <div className="space-y-4">
          <div className="space-y-2">
            {c.comments.map((cm) => (
              <div key={cm.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-[var(--muted)]">
                      {cm.authorName || 'Anonyme'} ·{' '}
                      {new Date(cm.createdAt).toLocaleString('fr-FR')}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{cm.body}</p>
                  </div>
                  <button
                    className="btn-ghost text-danger text-xs"
                    onClick={async () => {
                      await api(`/customers/${id}/comments/${cm.id}`, {
                        method: 'DELETE',
                      });
                      await load();
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {c.comments.length === 0 && (
              <div className="card p-6 text-center text-sm text-[var(--muted)]">
                Aucun commentaire
              </div>
            )}
          </div>
          <form
            className="card space-y-3 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/customers/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ body: commentBody }),
              });
              setCommentBody('');
              await load();
            }}
          >
            <label className="label">Nouveau commentaire</label>
            <textarea
              className="input min-h-[90px]"
              required
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button className="btn-primary">Publier</button>
          </form>
        </div>
      )}

      {/* RIB */}
      {tab === 'rib' && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {c.bankAccounts.map((b) => (
              <div key={b.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex gap-3">
                    <IconTile tone="emerald">
                      <IconId size={18} />
                    </IconTile>
                    <div>
                      <div className="font-semibold">
                        {b.label}{' '}
                        {b.isDefault && (
                          <span className="badge-ok ml-1">Par défaut</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm">{b.bankName || '—'}</div>
                      <div className="font-mono text-xs text-[var(--muted)]">
                        IBAN {b.iban || '—'}
                      </div>
                      <div className="font-mono text-xs text-[var(--muted)]">
                        BIC {b.bic || '—'}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Titulaire : {b.accountHolder || '—'}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn-ghost text-danger"
                    onClick={async () => {
                      await api(`/customers/${id}/bank-accounts/${b.id}`, {
                        method: 'DELETE',
                      });
                      await load();
                    }}
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form
            className="card grid gap-3 p-4 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/customers/${id}/bank-accounts`, {
                method: 'POST',
                body: JSON.stringify({ ...bankForm, isDefault: true }),
              });
              setBankForm({
                label: 'Principal',
                bankName: '',
                iban: '',
                bic: '',
                accountHolder: '',
                rum: '',
              });
              await load();
              setMsg('RIB enregistré.');
            }}
          >
            <h3 className="md:col-span-2 flex items-center gap-2 font-semibold">
              <IconSettings size={16} /> Ajouter un RIB
            </h3>
            <div>
              <label className="label">Libellé</label>
              <input
                className="input"
                value={bankForm.label}
                onChange={(e) =>
                  setBankForm({ ...bankForm, label: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Banque</label>
              <input
                className="input"
                value={bankForm.bankName}
                onChange={(e) =>
                  setBankForm({ ...bankForm, bankName: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">IBAN</label>
              <input
                className="input font-mono"
                value={bankForm.iban}
                onChange={(e) =>
                  setBankForm({ ...bankForm, iban: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">BIC</label>
              <input
                className="input font-mono"
                value={bankForm.bic}
                onChange={(e) =>
                  setBankForm({ ...bankForm, bic: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Titulaire</label>
              <input
                className="input"
                value={bankForm.accountHolder}
                onChange={(e) =>
                  setBankForm({ ...bankForm, accountHolder: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">RUM (prélèvement)</label>
              <input
                className="input"
                value={bankForm.rum}
                onChange={(e) =>
                  setBankForm({ ...bankForm, rum: e.target.value })
                }
              />
            </div>
            <button className="btn-primary md:col-span-2">
              <IconPlus size={16} /> Enregistrer le RIB
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
