/** Simple {{path}} / {{path|filter:arg}} interpolator for document templates. */

function getPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function formatMoney(n: unknown): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v)) return String(n ?? '');
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(v);
}

function formatDate(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(v: unknown): string {
  if (v == null || v === '') return '';
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('fr-FR');
}

function applyFilter(value: unknown, filter: string, arg?: string): string {
  switch (filter) {
    case 'money':
      return formatMoney(value);
    case 'date':
      return formatDate(value);
    case 'dateOnly':
      return formatDateOnly(value);
    case 'upper':
      return String(value ?? '').toUpperCase();
    case 'fallback': {
      // handled specially with context in render
      return String(value ?? '');
    }
    case 'raw':
      return String(value ?? '');
    default:
      return String(value ?? '');
  }
}

function autoFormat(path: string, value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    if (
      /amount|price|ht|ttc|balance|margin/i.test(path) &&
      !/rate|count|passengers|vatRate/i.test(path)
    ) {
      return formatMoney(value);
    }
    return String(value);
  }
  if (
    value instanceof Date ||
    (/At$|Date$|today|issuedAt|validUntil|proposedAt|startsAt|endsAt|departure|return|garage|presentation|onSite/i.test(
      path,
    ) &&
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}/.test(value))
  ) {
    return formatDate(value);
  }
  return String(value);
}

/**
 * Replace {{path}} and {{path|filter}} / {{path|fallback:other.path}}
 */
export function renderTemplate(
  html: string,
  data: Record<string, unknown>,
): string {
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr: string) => {
    const parts = expr.split('|').map((s) => s.trim());
    const path = parts[0];
    let value = getPath(data, path);

    for (let i = 1; i < parts.length; i++) {
      const [filter, arg] = parts[i].split(':').map((s) => s.trim());
      if (filter === 'fallback') {
        if (value == null || value === '') {
          value = getPath(data, arg);
        }
        continue;
      }
      return applyFilter(value, filter, arg);
    }

    if (parts.length === 1) return autoFormat(path, value);
    return String(value ?? '');
  });
}

export function wrapPrintDocument(opts: {
  title: string;
  bodyHtml: string;
  headerHtml?: string | null;
  footerHtml?: string | null;
  stylesCss?: string | null;
  paperSize?: string;
  orientation?: string;
}): string {
  const size = opts.paperSize || 'A4';
  const orientation = opts.orientation || 'portrait';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { size: ${size} ${orientation}; }
    ${opts.stylesCss || ''}
  </style>
</head>
<body>
  <div class="no-print" style="position:sticky;top:0;z-index:10;background:#0f172a;color:#fff;padding:10px 16px;display:flex;gap:8px;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif">
    <span style="font-weight:600">${escapeHtml(opts.title)}</span>
    <span>
      <button onclick="window.print()" style="background:#2563eb;color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:600">Imprimer</button>
      <button onclick="window.close()" style="background:#334155;color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;margin-left:6px">Fermer</button>
    </span>
  </div>
  <main style="padding:8mm">
    ${opts.headerHtml || ''}
    ${opts.bodyHtml}
    ${opts.footerHtml || ''}
  </main>
  <script>window.addEventListener('load',()=>{ setTimeout(()=>{ try{ window.focus(); }catch(e){} }, 200); });</script>
</body>
</html>`;
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function frToday() {
  return new Date().toLocaleDateString('fr-FR');
}
