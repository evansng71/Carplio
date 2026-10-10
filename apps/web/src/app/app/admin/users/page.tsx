'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { IconPlus, IconTile, IconUsers } from '@/components/Icons';

type GroupRef = { id: string; key: string; name: string };
type Membership = { id: string; group: GroupRef; depot?: { name: string } | null };
type UserRow = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  memberships: Membership[];
  sessions: Array<{ id: string; createdAt: string }>;
};

type GroupRow = {
  id: string;
  key: string;
  name: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  invited: 'Invité',
  suspended: 'Suspendu',
  not_created: 'Non créé',
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'active'
      ? 'bg-ok/10 text-ok'
      : status === 'suspended'
        ? 'bg-danger/10 text-danger'
        : status === 'invited'
          ? 'bg-warn/10 text-warn'
          : 'bg-night/5 text-[var(--muted)]';
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function AdminUsersPage() {
  const { can, me } = useAuth();
  const canManage = can('users:account:manage') || me?.isSuperAdmin;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({
    email: '',
    displayName: '',
    groupIds: [] as string[],
  });
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [inviteToken, setInviteToken] = useState('');

  const load = useCallback(async () => {
    const [u, g] = await Promise.all([
      api<UserRow[]>('/users'),
      api<GroupRow[]>('/groups'),
    ]);
    setUsers(u);
    setGroups(g);
    setSelectedId((prev) => prev || u[0]?.id || null);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        u.displayName.toLowerCase().includes(s) ||
        u.status.toLowerCase().includes(s),
    );
  }, [users, q]);

  const selected = users.find((u) => u.id === selectedId) || null;

  useEffect(() => {
    if (selected) {
      setEditGroups(selected.memberships.map((m) => m.group.id));
    }
  }, [selected]);

  async function runAction(fn: () => Promise<void>, okMsg: string) {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await fn();
      await load();
      setMsg(okMsg);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    await runAction(async () => {
      const res = await api<{ invitationToken?: string }>('/users', {
        method: 'POST',
        body: JSON.stringify(invite),
      });
      setInviteToken(res.invitationToken || '');
      setInviteOpen(false);
      setInvite({ email: '', displayName: '', groupIds: [] });
    }, 'Utilisateur invité.');
  }

  async function saveMemberships() {
    if (!selected) return;
    await runAction(async () => {
      await api(`/users/${selected.id}/memberships`, {
        method: 'PATCH',
        body: JSON.stringify({ groupIds: editGroups }),
      });
    }, 'Groupes mis à jour.');
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconTile tone="violet" className="h-12 w-12">
            <IconUsers size={22} />
          </IconTile>
          <div>
            <Link
              href="/app/admin"
              className="text-xs font-semibold text-action hover:underline"
            >
              ← Administration
            </Link>
            <h1 className="mt-1 text-2xl font-bold">Utilisateurs</h1>
            <p className="text-sm text-[var(--muted)]">
              Comptes d’accès, groupes et cycle de vie (invitation, suspension).
            </p>
          </div>
        </div>
        {canManage && (
          <button
            className="btn-primary"
            onClick={() => setInviteOpen((v) => !v)}
          >
            <IconPlus size={16} />
            {inviteOpen ? 'Fermer' : 'Inviter un utilisateur'}
          </button>
        )}
      </div>

      {inviteOpen && canManage && (
        <form onSubmit={onInvite} className="card space-y-3 p-4">
          <h2 className="font-semibold">Nouvelle invitation</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Nom affiché</label>
              <input
                className="input"
                required
                value={invite.displayName}
                onChange={(e) =>
                  setInvite({ ...invite, displayName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={invite.email}
                onChange={(e) =>
                  setInvite({ ...invite, email: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Groupes</label>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = invite.groupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      on
                        ? 'border-action bg-action/10 text-action'
                        : 'border-[var(--border)] text-[var(--muted)]'
                    }`}
                    onClick={() =>
                      setInvite({
                        ...invite,
                        groupIds: on
                          ? invite.groupIds.filter((id) => id !== g.id)
                          : [...invite.groupIds, g.id],
                      })
                    }
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-primary" disabled={busy}>
            Envoyer l’invitation
          </button>
        </form>
      )}

      {inviteToken && (
        <div className="rounded-xl border border-action/30 bg-action/5 px-4 py-3 text-sm">
          <div className="font-semibold text-action">Lien d’activation (démo)</div>
          <code className="mt-1 block break-all text-xs">
            /activate?token={inviteToken}
          </code>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] p-3">
            <input
              className="input"
              placeholder="Rechercher nom, email, statut…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-night/5 text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Utilisateur</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Groupes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className={`cursor-pointer border-t border-[var(--border)] ${
                      selectedId === u.id ? 'bg-action/5' : 'hover:bg-night/[0.03]'
                    }`}
                    onClick={() => setSelectedId(u.id)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{u.displayName}</div>
                      <div className="text-xs text-[var(--muted)]">{u.email}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--muted)]">
                      {u.memberships.map((m) => m.group.name).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-8 text-center text-sm text-[var(--muted)]"
                    >
                      Aucun utilisateur
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card space-y-4 p-4">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">
              Sélectionnez un utilisateur.
            </p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{selected.displayName}</h2>
                <p className="text-sm text-[var(--muted)]">{selected.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  {selected.mfaEnabled && (
                    <span className="rounded-full bg-action/10 px-2.5 py-0.5 text-xs font-semibold text-action">
                      MFA
                    </span>
                  )}
                  <span className="rounded-full bg-night/5 px-2.5 py-0.5 text-xs text-[var(--muted)]">
                    {selected.sessions.length} session(s)
                  </span>
                </div>
              </div>

              <div>
                <div className="label">Groupes</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const on = editGroups.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={!canManage || busy}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          on
                            ? 'border-action bg-action/10 text-action'
                            : 'border-[var(--border)] text-[var(--muted)]'
                        }`}
                        onClick={() =>
                          setEditGroups(
                            on
                              ? editGroups.filter((id) => id !== g.id)
                              : [...editGroups, g.id],
                          )
                        }
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
                {canManage && (
                  <button
                    className="btn-primary mt-3"
                    disabled={busy}
                    onClick={saveMemberships}
                  >
                    Enregistrer les groupes
                  </button>
                )}
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  {selected.status !== 'suspended' ? (
                    <button
                      className="btn-danger"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            api(`/users/${selected.id}/suspend`, {
                              method: 'POST',
                              body: '{}',
                            }),
                          'Utilisateur suspendu.',
                        )
                      }
                    >
                      Suspendre
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            api(`/users/${selected.id}/reactivate`, {
                              method: 'POST',
                              body: '{}',
                            }),
                          'Utilisateur réactivé.',
                        )
                      }
                    >
                      Réactiver
                    </button>
                  )}
                  <button
                    className="btn-ghost border border-[var(--border)]"
                    disabled={busy}
                    onClick={() =>
                      runAction(
                        () =>
                          api(`/users/${selected.id}/revoke-sessions`, {
                            method: 'POST',
                            body: '{}',
                          }),
                        'Sessions révoquées.',
                      )
                    }
                  >
                    Révoquer sessions
                  </button>
                  <button
                    className="btn-ghost border border-[var(--border)]"
                    disabled={busy}
                    onClick={() =>
                      runAction(async () => {
                        const res = await api<{ invitationToken: string }>(
                          `/users/${selected.id}/resend-invitation`,
                          { method: 'POST', body: '{}' },
                        );
                        setInviteToken(res.invitationToken);
                      }, 'Invitation renvoyée.')
                    }
                  >
                    Renvoyer invitation
                  </button>
                </div>
              )}

              <div className="text-xs text-[var(--muted)]">
                Dernière connexion :{' '}
                {selected.lastLoginAt
                  ? new Date(selected.lastLoginAt).toLocaleString('fr-FR')
                  : 'jamais'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
