'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { IconFile, IconPlus, IconTile } from '@/components/Icons';
import {
  BLOCK_LIBRARY,
  DocBlock,
  LayoutDoc,
  blockLabel,
  compileLayout,
  defaultLayoutFor,
  fieldGroupsFor,
  parseLayout,
} from '@/lib/document-blocks';

type KindMeta = {
  kind: string;
  label: string;
  description: string;
  variables: Array<{ key: string; label: string }>;
};

type DocTemplate = {
  id: string;
  kind: string;
  key: string;
  name: string;
  description?: string | null;
  bodyHtml: string;
  layoutJson?: string | null;
  stylesCss?: string | null;
  paperSize: string;
  orientation: string;
  isDefault: boolean;
  isSystem: boolean;
  active: boolean;
  version: number;
};

const KIND_ICONS: Record<string, string> = {
  quote: 'Devis',
  invoice: 'Factures',
  planning: 'Planning',
  collective_ticket: 'Billets',
  order: 'Commandes',
  payslip: 'Bulletins de paie',
};

export default function DocumentTemplatesPage() {
  const [kinds, setKinds] = useState<KindMeta[]>([]);
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [kindFilter, setKindFilter] = useState('quote');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [layout, setLayout] = useState<LayoutDoc | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kindMeta = kinds.find((k) => k.kind === kindFilter);
  const filtered = useMemo(
    () => templates.filter((t) => t.kind === kindFilter),
    [templates, kindFilter],
  );
  const selectedBlock = layout?.blocks.find((b) => b.id === selectedBlockId);

  const load = useCallback(async () => {
    const [catalog, list] = await Promise.all([
      api<{ kinds: KindMeta[] }>('/document-templates/catalog'),
      api<DocTemplate[]>('/document-templates'),
    ]);
    setKinds(catalog.kinds);
    setTemplates(list);
    return list;
  }, []);

  function applyTemplate(t: DocTemplate) {
    setSelectedId(t.id);
    setName(t.name);
    setIsDefault(t.isDefault);
    const parsed = parseLayout(t.layoutJson);
    const next = parsed || defaultLayoutFor(t.kind);
    setLayout(next);
    setSelectedBlockId(next.blocks[0]?.id || null);
    setMsg('');
    setErr('');
  }

  useEffect(() => {
    load()
      .then((list) => {
        const pick =
          list.find((t) => t.kind === kindFilter && t.isDefault) ||
          list.find((t) => t.kind === kindFilter) ||
          list[0];
        if (pick) {
          setKindFilter(pick.kind);
          applyTemplate(pick);
        }
      })
      .catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compiled = useMemo(() => {
    if (!layout) return null;
    return compileLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!compiled || !kindFilter) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await api<{ html: string }>('/document-templates/preview', {
          method: 'POST',
          body: JSON.stringify({
            kind: kindFilter,
            bodyHtml: compiled.bodyHtml,
            stylesCss: compiled.stylesCss,
            paperSize: 'A4',
            orientation: 'portrait',
          }),
        });
        setPreviewHtml(res.html);
      } catch {
        /* soft */
      }
    }, 350);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [compiled, kindFilter]);

  function updateBlock(id: string, patch: Partial<DocBlock>) {
    setLayout((L) => {
      if (!L) return L;
      return {
        ...L,
        blocks: L.blocks.map((b) =>
          b.id === id ? ({ ...b, ...patch } as DocBlock) : b,
        ),
      };
    });
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setLayout((L) => {
      if (!L) return L;
      const i = L.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= L.blocks.length) return L;
      const blocks = [...L.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...L, blocks };
    });
  }

  function removeBlock(id: string) {
    setLayout((L) => {
      if (!L) return L;
      const blocks = L.blocks.filter((b) => b.id !== id);
      if (selectedBlockId === id) setSelectedBlockId(blocks[0]?.id || null);
      return { ...L, blocks };
    });
  }

  function addBlock(type: DocBlock['type']) {
    const def = BLOCK_LIBRARY.find((b) => b.type === type);
    if (!def || !layout) return;
    const block = def.create();
    setLayout({ ...layout, blocks: [...layout.blocks, block] });
    setSelectedBlockId(block.id);
  }

  async function save() {
    if (!selectedId || !layout || !compiled) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const updated = await api<DocTemplate>(`/document-templates/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          isDefault,
          layoutJson: JSON.stringify(layout),
          bodyHtml: compiled.bodyHtml,
          stylesCss: compiled.stylesCss,
          headerHtml: null,
          footerHtml: null,
        }),
      });
      setMsg(
        `Modèle enregistré — utilisé sera utilisé lors du bouton Imprimer (${KIND_ICONS[updated.kind] || updated.kind}).`,
      );
      const list = await load();
      const t = list.find((x) => x.id === updated.id);
      if (t) applyTemplate(t);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    setBusy(true);
    try {
      const layout0 = defaultLayoutFor(kindFilter);
      const compiled0 = compileLayout(layout0);
      const created = await api<DocTemplate>('/document-templates', {
        method: 'POST',
        body: JSON.stringify({
          kind: kindFilter,
          name: `Nouveau modèle — ${kindMeta?.label || kindFilter}`,
          bodyHtml: compiled0.bodyHtml,
          stylesCss: compiled0.stylesCss,
          layoutJson: JSON.stringify(layout0),
          isDefault: filtered.length === 0,
        }),
      });
      await load();
      applyTemplate(created);
      setMsg('Nouveau modèle créé');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const copy = await api<DocTemplate>(
        `/document-templates/${selectedId}/duplicate`,
        { method: 'POST', body: '{}' },
      );
      await load();
      applyTemplate(copy);
      setMsg('Copie créée');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetLayout() {
    if (!confirm('Remettre la mise en page d’origine pour ce type de document ?'))
      return;
    const next = defaultLayoutFor(kindFilter);
    setLayout(next);
    setSelectedBlockId(next.blocks[0]?.id || null);
    setMsg('Mise en page d’origine restaurée — pensez à Enregistrer');
  }

  function insertFieldInText(key: string) {
    if (!selectedBlock) return;
    if (selectedBlock.type === 'text' || selectedBlock.type === 'section_title' || selectedBlock.type === 'footer_note') {
      updateBlock(selectedBlock.id, {
        text: `${(selectedBlock as { text: string }).text || ''}{{${key}}}`,
      } as Partial<DocBlock>);
    }
  }

  const addable = BLOCK_LIBRARY.filter(
    (b) => !b.kinds || b.kinds.includes(kindFilter),
  );

  const fieldGroups = fieldGroupsFor(kindFilter, kindMeta?.variables || []);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="amber">
            <IconFile />
          </IconTile>
          <div>
            <p className="page-kicker">Administration</p>
            <h1 className="text-2xl font-bold">Modèles d’impression</h1>
            <p className="max-w-2xl text-sm text-[var(--muted)]">
              Composez la page comme vous voulez : ajoutez des blocs, placez les
              informations, enregistrez. Le bouton <strong>Imprimer</strong> dans
              Devis / Factures / Planning / Missions utilisera automatiquement le
              modèle marqué « utilisé à l’impression ».
            </p>
          </div>
        </div>
        <Link href="/app/admin" className="btn-secondary">
          Retour
        </Link>
      </div>

      {(msg || err) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            err
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {err || msg}
        </div>
      )}

      {/* Type de document */}
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            className={`rounded-xl px-4 py-2 text-left text-sm transition ${
              kindFilter === k.kind
                ? 'bg-night text-white shadow'
                : 'bg-white text-[var(--fg)] ring-1 ring-[var(--border)] hover:ring-action/40'
            }`}
            onClick={() => {
              setKindFilter(k.kind);
              const first =
                templates.find((t) => t.kind === k.kind && t.isDefault) ||
                templates.find((t) => t.kind === k.kind);
              if (first) applyTemplate(first);
              else {
                setSelectedId(null);
                setLayout(null);
              }
            }}
          >
            <div className="font-semibold">{k.label}</div>
            <div
              className={`text-[11px] ${kindFilter === k.kind ? 'text-white/70' : 'text-[var(--muted)]'}`}
            >
              {k.description}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
        {/* Liste modèles */}
        <aside className="card space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Vos modèles
            </span>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={createNew}
              disabled={busy}
              title="Créer un modèle"
            >
              <IconPlus size={14} />
            </button>
          </div>
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm ${
                selectedId === t.id
                  ? 'bg-action/10 ring-1 ring-action/35'
                  : 'hover:bg-[var(--surface-2)]'
              }`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {t.isDefault && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                    Utilisé à l’impression
                  </span>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-[var(--muted)]">
              Aucun modèle — cliquez sur + pour en créer un.
            </p>
          )}
        </aside>

        {/* Canvas + propriétés */}
        <section className="space-y-3">
          {layout && (
            <div className="card space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label className="label">Nom du modèle</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  Utiliser ce modèle quand on clique sur Imprimer
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={save}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={duplicate}
                >
                  Dupliquer
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={resetLayout}
                >
                  Revenir au modèle d’origine
                </button>
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Composition de la page</h2>
                <p className="text-xs text-[var(--muted)]">
                  Cliquez un bloc pour le modifier. Utilisez ↑ ↓ pour le déplacer.
                </p>
              </div>
            </div>

            {!layout ? (
              <p className="text-sm text-[var(--muted)]">
                Sélectionnez ou créez un modèle.
              </p>
            ) : (
              <div className="space-y-2">
                {layout.blocks.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`rounded-xl border px-3 py-2 transition ${
                      selectedBlockId === b.id
                        ? 'border-action bg-action/5 shadow-sm'
                        : 'border-[var(--border)] bg-white hover:border-action/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSelectedBlockId(b.id)}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Bloc {idx + 1}
                        </div>
                        <div className="font-medium">{blockLabel(b)}</div>
                        <div className="truncate text-xs text-[var(--muted)]">
                          {blockSummary(b)}
                        </div>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2 text-xs"
                          title="Monter"
                          onClick={() => moveBlock(b.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 text-xs"
                          title="Descendre"
                          onClick={() => moveBlock(b.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 text-xs text-danger"
                          title="Retirer"
                          onClick={() => removeBlock(b.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {selectedBlockId === b.id && (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <BlockEditor
                          block={b}
                          variables={kindMeta?.variables || []}
                          onChange={(patch) => updateBlock(b.id, patch)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {layout && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Ajouter un élément
                </div>
                <div className="flex flex-wrap gap-2">
                  {addable.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left text-xs hover:border-action hover:bg-action/5"
                      onClick={() => addBlock(item.type)}
                      title={item.hint}
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[var(--muted)]">{item.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {layout && (
            <div className="card p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Informations à insérer dans un texte
              </div>
              <p className="mb-2 text-xs text-[var(--muted)]">
                Sélectionnez un bloc « Texte », « Titre » ou « Pied de page », puis
                cliquez une information ci-dessous.
              </p>
              <div className="space-y-3">
                {fieldGroups.map((g) => (
                  <div key={g.group}>
                    <div className="mb-1 text-[11px] font-semibold text-night">
                      {g.group}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          className="rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] hover:border-action hover:text-action"
                          onClick={() => insertFieldInText(v.key)}
                          title={v.key}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Aperçu impression */}
        <aside className="card flex flex-col overflow-hidden p-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <div>
              <div className="text-sm font-semibold">Aperçu avant impression</div>
              <div className="text-[11px] text-[var(--muted)]">
                Données d’exemple
              </div>
            </div>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={!previewHtml}
              onClick={() => {
                const w = window.open('', '_blank');
                if (!w || !previewHtml) return;
                w.document.open();
                w.document.write(previewHtml);
                w.document.close();
              }}
            >
              Imprimer l’aperçu
            </button>
          </div>
          <iframe
            title="Aperçu"
            className="min-h-[520px] w-full flex-1 bg-[#e2e8f0]"
            srcDoc={
              previewHtml ||
              '<p style="padding:24px;font-family:sans-serif;color:#64748b">L’aperçu apparaît ici…</p>'
            }
          />
        </aside>
      </div>
    </div>
  );
}

function blockSummary(b: DocBlock): string {
  switch (b.type) {
    case 'company_header':
      return 'Coordonnées de votre entreprise';
    case 'document_title':
      return `${b.badgeLabel} · numéro dynamique`;
    case 'info_cards':
      return `${b.leftTitle}${b.rightTitle ? ` / ${b.rightTitle}` : ''}`;
    case 'section_title':
    case 'text':
    case 'footer_note':
      return b.text.slice(0, 80);
    case 'trip_summary':
      return 'Trajet, horaires et flotte';
    case 'pricing_quote':
      return 'Montants du devis';
    case 'pricing_invoice':
      return 'Montants de la facture';
    case 'key_value_table':
      return `${b.rows.length} ligne(s)`;
    case 'html_slot':
      return b.title || b.key;
    case 'spacer':
      return `Espace ${b.size}`;
    default:
      return '';
  }
}

function BlockEditor({
  block,
  variables,
  onChange,
}: {
  block: DocBlock;
  variables: Array<{ key: string; label: string }>;
  onChange: (patch: Partial<DocBlock>) => void;
}) {
  if (block.type === 'company_header') {
    return (
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={block.showTradeName}
            onChange={(e) =>
              onChange({ showTradeName: e.target.checked } as Partial<DocBlock>)
            }
          />
          Afficher l’enseigne
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={block.showSiret}
            onChange={(e) =>
              onChange({ showSiret: e.target.checked } as Partial<DocBlock>)
            }
          />
          Afficher le SIRET
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={block.showVat}
            onChange={(e) =>
              onChange({ showVat: e.target.checked } as Partial<DocBlock>)
            }
          />
          Afficher le n° TVA
        </label>
      </div>
    );
  }

  if (block.type === 'document_title') {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <label className="label">Libellé (ex. DEVIS)</label>
          <input
            className="input"
            value={block.badgeLabel}
            onChange={(e) =>
              onChange({ badgeLabel: e.target.value } as Partial<DocBlock>)
            }
          />
        </div>
        <FieldSelect
          label="Numéro du document"
          value={block.numberKey}
          variables={variables}
          onChange={(numberKey) =>
            onChange({ numberKey } as Partial<DocBlock>)
          }
        />
        <div>
          <label className="label">Libellé de la date</label>
          <input
            className="input"
            value={block.dateLabel}
            onChange={(e) =>
              onChange({ dateLabel: e.target.value } as Partial<DocBlock>)
            }
          />
        </div>
        <FieldSelect
          label="Champ date"
          value={block.dateKey}
          variables={variables}
          onChange={(dateKey) => onChange({ dateKey } as Partial<DocBlock>)}
        />
        <div>
          <label className="label">2ᵉ libellé (optionnel)</label>
          <input
            className="input"
            value={block.extraLabel || ''}
            onChange={(e) =>
              onChange({ extraLabel: e.target.value } as Partial<DocBlock>)
            }
          />
        </div>
        <FieldSelect
          label="2ᵉ champ (optionnel)"
          value={block.extraKey || ''}
          variables={variables}
          allowEmpty
          onChange={(extraKey) =>
            onChange({
              extraKey: extraKey || undefined,
            } as Partial<DocBlock>)
          }
        />
      </div>
    );
  }

  if (block.type === 'info_cards') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CardLinesEditor
          title={block.leftTitle}
          lines={block.leftLines}
          variables={variables}
          onTitle={(leftTitle) => onChange({ leftTitle } as Partial<DocBlock>)}
          onLines={(leftLines) => onChange({ leftLines } as Partial<DocBlock>)}
        />
        <CardLinesEditor
          title={block.rightTitle}
          lines={block.rightLines}
          variables={variables}
          onTitle={(rightTitle) =>
            onChange({ rightTitle } as Partial<DocBlock>)
          }
          onLines={(rightLines) =>
            onChange({ rightLines } as Partial<DocBlock>)
          }
        />
      </div>
    );
  }

  if (
    block.type === 'text' ||
    block.type === 'section_title' ||
    block.type === 'footer_note'
  ) {
    return (
      <div>
        <label className="label">
          {block.type === 'footer_note'
            ? 'Mention de bas de page'
            : block.type === 'section_title'
              ? 'Titre'
              : 'Texte'}
        </label>
        <textarea
          className="input min-h-[72px]"
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<DocBlock>)}
        />
      </div>
    );
  }

  if (block.type === 'key_value_table') {
    return (
      <CardLinesEditor
        title="Lignes du tableau"
        lines={block.rows}
        variables={variables}
        onTitle={() => undefined}
        onLines={(rows) => onChange({ rows } as Partial<DocBlock>)}
        hideTitle
      />
    );
  }

  if (block.type === 'html_slot') {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <label className="label">Titre au-dessus</label>
          <input
            className="input"
            value={block.title || ''}
            onChange={(e) =>
              onChange({ title: e.target.value } as Partial<DocBlock>)
            }
          />
        </div>
        <FieldSelect
          label="Contenu généré"
          value={block.key}
          variables={variables}
          onChange={(key) => onChange({ key } as Partial<DocBlock>)}
        />
      </div>
    );
  }

  if (block.type === 'spacer') {
    return (
      <div>
        <label className="label">Taille de l’espace</label>
        <select
          className="input"
          value={block.size}
          onChange={(e) =>
            onChange({
              size: e.target.value as 'sm' | 'md' | 'lg',
            } as Partial<DocBlock>)
          }
        >
          <option value="sm">Petit</option>
          <option value="md">Moyen</option>
          <option value="lg">Grand</option>
        </select>
      </div>
    );
  }

  return (
    <p className="text-xs text-[var(--muted)]">
      Ce bloc n’a pas de réglage supplémentaire — il s’adapte automatiquement aux
      données du document.
    </p>
  );
}

function FieldSelect({
  label,
  value,
  variables,
  onChange,
  allowEmpty,
}: {
  label: string;
  value: string;
  variables: Array<{ key: string; label: string }>;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">— Aucun —</option>}
        {variables.map((v) => (
          <option key={v.key} value={v.key}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CardLinesEditor({
  title,
  lines,
  variables,
  onTitle,
  onLines,
  hideTitle,
}: {
  title: string;
  lines: Array<{ label: string; key: string }>;
  variables: Array<{ key: string; label: string }>;
  onTitle: (t: string) => void;
  onLines: (lines: Array<{ label: string; key: string }>) => void;
  hideTitle?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg bg-[var(--surface-2)] p-3">
      {!hideTitle && (
        <div>
          <label className="label">Titre de l’encadré</label>
          <input
            className="input"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
          />
        </div>
      )}
      {hideTitle && <div className="text-xs font-semibold">{title}</div>}
      {lines.map((line, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
          <input
            className="input text-xs"
            placeholder="Libellé"
            value={line.label}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], label: e.target.value };
              onLines(next);
            }}
          />
          <select
            className="input text-xs"
            value={line.key}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], key: e.target.value };
              onLines(next);
            }}
          >
            {variables.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-ghost text-danger text-xs"
            onClick={() => onLines(lines.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary text-xs"
        onClick={() =>
          onLines([
            ...lines,
            { label: 'Nouveau', key: variables[0]?.key || 'today' },
          ])
        }
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}
