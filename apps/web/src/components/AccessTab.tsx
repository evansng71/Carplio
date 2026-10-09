'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type AccessInfo =
  | { status: 'not_created' }
  | {
      user: {
        id: string;
        email: string;
        status: string;
        lastLoginAt?: string;
        memberships: Array<{ group: { name: string; key: string } }>;
        invitations: Array<{ id: string; expiresAt: string; acceptedAt?: string }>;
        sessions?: Array<{ id: string }>;
      };
    };

export function AccessTab({ employeeId }: { employeeId: string }) {
  const [info, setInfo] = useState<AccessInfo | null>(null);
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');

  const load = () =>
    api<AccessInfo>(`/employees/${employeeId}/access`).then(setInfo);

  useEffect(() => {
    load();
  }, [employeeId]);

  if (!info) return <p className="text-sm">Chargement accès…</p>;

  if ('status' in info && info.status === 'not_created') {
    return (
      <div className="card space-y-3 p-4">
        <h3 className="font-semibold">Accès logiciel & portail</h3>
        <p className="text-sm text-[var(--muted)]">
          Aucun compte nominatif lié. Création + invitation sécurisée.
        </p>
        <button
          className="btn-primary"
          onClick={async () => {
            const res = await api<{
              invitationToken: string;
              user: { email: string };
            }>(`/employees/${employeeId}/access`, {
              method: 'POST',
              body: JSON.stringify({ groupKeys: ['driver'] }),
            });
            setToken(res.invitationToken);
            setMsg(`Invitation créée pour ${res.user.email}`);
            load();
          }}
        >
          Créer un accès
        </button>
        {token && (
          <p className="rounded-lg bg-action/10 p-3 text-xs">
            Lien d’activation (DEMO, affiché une seule fois) :{' '}
            <code>/activate?token={token}</code>
          </p>
        )}
      </div>
    );
  }

  const user = 'user' in info ? info.user : null;
  if (!user) return null;

  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-semibold">Accès logiciel & portail</h3>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div>Statut : <strong>{user.status}</strong></div>
        <div>Identifiant : {user.email}</div>
        <div>
          Dernière connexion :{' '}
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString('fr-FR')
            : '—'}
        </div>
        <div>
          Groupes : {user.memberships.map((m) => m.group.name).join(', ') || '—'}
        </div>
        <div>Sessions actives : {user.sessions?.length ?? 0}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-ghost border border-[var(--border)]"
          onClick={async () => {
            const res = await api<{ invitationToken: string }>(
              `/users/${user.id}/resend-invitation`,
              { method: 'POST', body: '{}' },
            );
            setToken(res.invitationToken);
            setMsg('Invitation renvoyée');
          }}
        >
          Réenvoyer invitation
        </button>
        <button
          className="btn-danger"
          onClick={async () => {
            await api(`/users/${user.id}/suspend`, { method: 'POST', body: '{}' });
            setMsg('Accès suspendu — sessions révoquées');
            load();
          }}
        >
          Suspendre
        </button>
        <button
          className="btn-primary"
          onClick={async () => {
            await api(`/users/${user.id}/reactivate`, {
              method: 'POST',
              body: '{}',
            });
            setMsg('Accès réactivé');
            load();
          }}
        >
          Réactiver
        </button>
        <button
          className="btn-ghost border border-[var(--border)]"
          onClick={async () => {
            await api(`/users/${user.id}/revoke-sessions`, {
              method: 'POST',
              body: '{}',
            });
            setMsg('Sessions révoquées');
            load();
          }}
        >
          Révoquer sessions
        </button>
      </div>
      {msg && <p className="text-sm text-action">{msg}</p>}
      {token && (
        <p className="rounded-lg bg-action/10 p-3 text-xs">
          Token invitation DEMO : <code>{token}</code> — activer via /activate
        </p>
      )}
    </div>
  );
}
