'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { IconId, IconPlus, IconTile } from '@/components/Icons';

type Permission = {
  id: string;
  key: string;
  label: string;
  module: string;
  resource: string;
  action: string;
  sensitive?: boolean;
};

type GroupRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{
    denied: boolean;
    scope: string;
    permission: { key: string; label: string };
  }>;
  _count: { memberships: number };
};

export default function AdminGroupsPage() {
  const { can, me } = useAuth();
  const canManage = can('groups:group:manage') || me?.isSuperAdmin;
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'detail' | 'matrix'>('detail');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '' });
  const [moduleFilter, setModuleFilter] = useState('all');

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([
      api<GroupRow[]>('/groups'),
      api<Permission[]>('/permissions'),
    ]);
    setGroups(g);
    setPerms(p);
    setSelectedId((prev) => prev || g[0]?.id || null);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const selected = groups.find((g) => g.id === selectedId) || null;
  const modules = useMemo(
    () => Array.from(new Set(perms.map((p) => p.module))).sort(),
    [perms],
  );

  const filteredPerms = useMemo(
    () =>
      moduleFilter === 'all'
        ? perms
        : perms.filter((p) => p.module === moduleFilter),
    [perms, moduleFilter],
  );

  function permState(group: GroupRow, key: string) {
    const gp = group.permissions.find((x) => x.permission.key === key);
    if (!gp) return 'off' as const;
    if (gp.denied) return 'deny' as const;
    return 'on' as const;
  }

  async function togglePerm(groupId: string, permissionKey: string) {
    if (!canManage) return;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const state = permState(group, permissionKey);
    const next =
      state === 'off' ? { enabled: true, denied: false } : { enabled: false };

    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api(`/groups/${groupId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ permissionKey, ...next }),
      });
      await load();
      setMsg('Permission mise à jour.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const g = await api<GroupRow>('/groups', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCreateOpen(false);
      setForm({ key: '', name: '', description: '' });
      await load();
      setSelectedId(g.id);
      setMsg('Groupe créé.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveSelected() {
    if (!selected || selected.isSystem || !canManage) return;
    setBusy(true);
    try {
      await api(`/groups/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      });
      setSelectedId(null);
      await load();
      setMsg('Groupe archivé.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="amber" className="h-12 w-12">
            <IconId size={22} />
          </IconTile>
          <div>
            <Link
              href="/app/admin"
              className="text-xs font-semibold text-action hover:underline"
            >
              ← Administration
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Groupes & droits</h1>
            <p className="text-sm text-[var(--muted)]">
              Rôles métier et matrice de permissions Module × Ressource × Action.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={tab === 'detail' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('detail')}
          >
            Détail
          </button>
          <button
            className={tab === 'matrix' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('matrix')}
          >
            Matrice
          </button>
          {canManage && (
            <button
              className="btn-primary"
              onClick={() => setCreateOpen((v) => !v)}
            >
              <IconPlus size={16} />
              {createOpen ? 'Fermer' : 'Nouveau groupe'}
            </button>
          )}
        </div>
      </div>

      {createOpen && canManage && (
        <form onSubmit={onCreate} className="card grid gap-3 p-4 md:grid-cols-3">
          <div>
            <label className="label">Clé technique</label>
            <input
              className="input"
              required
              placeholder="ex: depot_manager"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nom</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <button className="btn-primary md:col-span-3" disabled={busy}>
            Créer le groupe
          </button>
        </form>
      )}

      {(msg || err) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            err ? 'bg-danger/10 text-danger' : 'bg-ok/10 text-ok'
          }`}
        >
          {err || msg}
        </p>
      )}

      {tab === 'detail' && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="card max-h-[620px] overflow-auto p-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left ${
                  selectedId === g.id
                    ? 'bg-action/10'
                    : 'hover:bg-night/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {g._count.memberships} membre(s)
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {g.key}
                  {g.isSystem ? ' · système' : ''}
                </div>
              </button>
            ))}
          </div>

          <div className="card space-y-4 p-4">
            {!selected ? (
              <p className="text-sm text-[var(--muted)]">
                Sélectionnez un groupe.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <p className="text-sm text-[var(--muted)]">
                      {selected.description || 'Sans description'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Clé <code>{selected.key}</code> ·{' '}
                      {selected.permissions.filter((p) => !p.denied).length}{' '}
                      permissions
                    </p>
                  </div>
                  {canManage && !selected.isSystem && (
                    <button
                      className="btn-danger"
                      disabled={busy}
                      onClick={archiveSelected}
                    >
                      Archiver
                    </button>
                  )}
                </div>

                <div>
                  <label className="label">Filtrer module</label>
                  <select
                    className="input max-w-xs"
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                  >
                    <option value="all">Tous les modules</option>
                    {modules.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[420px] space-y-1 overflow-auto">
                  {filteredPerms.map((p) => {
                    const state = permState(selected, p.key);
                    return (
                      <label
                        key={p.key}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={state === 'on'}
                          disabled={!canManage || busy}
                          onChange={() => togglePerm(selected.id, p.key)}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{p.label}</span>
                          <span className="ml-2 text-xs text-[var(--muted)]">
                            {p.key}
                          </span>
                          {p.sensitive && (
                            <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                              sensible
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'matrix' && (
        <div className="card overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-night/5">
              <tr>
                <th className="sticky left-0 bg-night/5 px-3 py-2">Permission</th>
                {groups.map((g) => (
                  <th key={g.id} className="px-2 py-2 text-center">
                    {g.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p.key} className="border-t border-[var(--border)]">
                  <td className="sticky left-0 bg-[var(--bg-elevated)] px-3 py-2">
                    {p.label}
                    <div className="text-[10px] text-[var(--muted)]">{p.key}</div>
                  </td>
                  {groups.map((g) => {
                    const state = permState(g, p.key);
                    return (
                      <td key={g.id} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={!canManage || busy}
                          className={`h-7 w-7 rounded-md text-sm font-bold ${
                            state === 'on'
                              ? 'bg-ok/15 text-ok'
                              : state === 'deny'
                                ? 'bg-danger/15 text-danger'
                                : 'bg-night/5 text-[var(--muted)]'
                          }`}
                          onClick={() => togglePerm(g.id, p.key)}
                          title={
                            state === 'on'
                              ? 'Autorisé'
                              : state === 'deny'
                                ? 'Refusé'
                                : 'Non attribué'
                          }
                        >
                          {state === 'on' ? '✓' : state === 'deny' ? '✕' : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
