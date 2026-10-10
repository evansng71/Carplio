'use client';

import { IconSearch } from '@/components/Icons';

export type FilterOption = { value: string; label: string };

export type SortOption = { value: string; label: string };

type Props = {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  /** Filtres select : clé → valeur courante + options */
  filters?: Array<{
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (v: string) => void;
  }>;
  sort?: string;
  sortOptions?: SortOption[];
  onSort?: (v: string) => void;
  resultCount?: number;
  resultLabel?: string;
  children?: React.ReactNode;
};

export function CommercialFilters({
  search,
  onSearch,
  searchPlaceholder = 'Rechercher…',
  filters = [],
  sort,
  sortOptions,
  onSort,
  resultCount,
  resultLabel = 'résultat(s)',
  children,
}: Props) {
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <label className="label">Recherche</label>
          <span className="pointer-events-none absolute left-3 top-[34px] text-[var(--muted)]">
            <IconSearch size={16} />
          </span>
          <input
            className="input pl-9"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        {filters.map((f) => (
          <div key={f.key} className="min-w-[140px]">
            <label className="label">{f.label}</label>
            <select
              className="input"
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {sortOptions && onSort && (
          <div className="min-w-[160px]">
            <label className="label">Trier par</label>
            <select
              className="input"
              value={sort || sortOptions[0]?.value}
              onChange={(e) => onSort(e.target.value)}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {children}
      </div>
      {typeof resultCount === 'number' && (
        <p className="text-xs text-[var(--muted)]">
          {resultCount} {resultLabel}
        </p>
      )}
    </div>
  );
}

/** Helpers client-side filtering / sorting */
export function matchSearch(haystack: Array<string | null | undefined>, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((h) => (h || '').toLowerCase().includes(needle));
}

export function compareBy(
  a: unknown,
  b: unknown,
  dir: 'asc' | 'desc' = 'asc',
): number {
  const mul = dir === 'desc' ? -1 : 1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * mul;
  const sa = String(a);
  const sb = String(b);
  return sa.localeCompare(sb, 'fr', { numeric: true }) * mul;
}
