'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type AccessInfo =
  | {
      status: 'not_created';
      email?: string | null;
      isDriver?: boolean;
      suggestedGroups?: string[];
    }
  | {
      status: 'linked';
      portalRole?: string;
      user: {
        id: string;
        email: string;
        status: string;
        displayName?: string;
        lastLoginAt?: string | null;
        mustChangePassword?: boolean;
        tempPasswordSetAt?: string | null;
        memberships: Array<{ group: { name: string; key: string } }>;
        invitations: Array<{
          id: string;
          expiresAt: string;
          acceptedAt?: string | null;
        }>;
        sessions?: Array<{ id: string; createdAt?: string; ip?: string | null }>;
      };
    };

export function AccessTab({ employeeId }: { employeeId: string }) {
  const [info, setInfo] = useState<AccessInfo | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'temporary_password' | 'invitation'>(
    'temporary_password',
  );
  const [groupKeys, setGroupKeys] = useState<string[]>(['driver']);

  const load = () =>
    api<AccessInfo>(`/employees/${employeeId}/access`).then((res) => {
      setInfo(res);
      if (res.status === 'not_created') {
        setEmail(res.email || '');
        setGroupKeys(res.suggestedGroups?.length ? res.suggestedGroups : []);
      }
    });

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [employeeId]);

  function clearSecrets() {
    setTempPassword('');
    setInviteToken('');
  }

  if (!info && !err) {
    return <p className="text-sm text-[var(--muted)]">Chargement accès…</p>;
  }
  if (!info) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {err}
      </div>
    );
  }

  if (info.status === 'not_created') {
    return (
      <div className="card space-y-4 p-4">
        <div>
          <h3 className="font-semibold">Créer un accès logiciel</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Compte nominatif pour le portail salarié / conducteur. Le mot de
            passe temporaire est affiché une seule fois — notez-le pour le
            transmettre au salarié.
          </p>
        </div>

        <label className="block text-xs">
          Identifiant (e-mail)
          <input
            className="input mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@entreprise.fr"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase text-[var(--muted)]">
            Mode de création
          </legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={mode === 'temporary_password'}
              onChange={() => setMode('temporary_password')}
            />
            <span>
              <strong>Mot de passe temporaire</strong>
              <br />
              <span className="text-xs text-[var(--muted)]">
                Compte actif immédiatement — le salarié devra changer le MDP à
                la première connexion.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={mode === 'invitation'}
              onChange={() => setMode('invitation')}
            />
            <span>
              <strong>Lien d’invitation</strong>
              <br />
              <span className="text-xs text-[var(--muted)]">
                Le salarié choisit lui-même son mot de passe via /activate.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-3 text-xs">
          {['driver', 'dispatcher', 'hr_manager', 'sales'].map((key) => (
            <label key={key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={groupKeys.includes(key)}
                onChange={(e) => {
                  setGroupKeys((prev) =>
                    e.target.checked
                      ? [...prev, key]
                      : prev.filter((k) => k !== key),
                  );
                }}
              />
              {key}
            </label>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary"
          disabled={busy || !email.trim()}
          onClick={async () => {
            setBusy(true);
            setErr('');
            setMsg('');
            clearSecrets();
            try {
              const res = await api<{
                mode: string;
                temporaryPassword?: string;
                invitationToken?: string;
                user: { email: string };
              }>(`/employees/${employeeId}/access`, {
                method: 'POST',
                body: JSON.stringify({
                  email: email.trim(),
                  mode,
                  groupKeys,
                  portalRole: groupKeys.includes('driver')
                    ? 'driver'
                    : 'employee',
                }),
              });
              if (res.temporaryPassword) {
                setTempPassword(res.temporaryPassword);
                setMsg(
                  `Accès créé pour ${res.user.email} — communiquez le mot de passe temporaire ci-dessous.`,
                );
              } else if (res.invitationToken) {
                setInviteToken(res.invitationToken);
                setMsg(`Invitation créée pour ${res.user.email}`);
              } else {
                setMsg(`Accès créé pour ${res.user.email}`);
              }
              await load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Créer l’accès
        </button>

        {(msg || err) && (
          <p
            className={`text-sm ${err ? 'text-rose-700' : 'text-emerald-700'}`}
          >
            {err || msg}
          </p>
        )}
        {tempPassword && (
          <SecretBox
            title="Mot de passe temporaire (affichage unique)"
            value={tempPassword}
            hint="À remettre au salarié oralement ou par canal sécurisé. Il ne pourra plus être relu ensuite."
          />
        )}
        {inviteToken && (
          <SecretBox
            title="Lien d’activation (affichage unique)"
            value={`/activate?token=${inviteToken}`}
          />
        )}
      </div>
    );
  }

  const user = info.user;

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Accès logiciel & portail</h3>
          <p className="text-sm text-[var(--muted)]">
            Compte lié · rôle portail {info.portalRole || '—'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            user.status === 'active'
              ? 'bg-emerald-100 text-emerald-800'
              : user.status === 'suspended'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-amber-100 text-amber-900'
          }`}
        >
          {user.status}
        </span>
      </div>

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <div>
          Identifiant : <strong>{user.email}</strong>
        </div>
        <div>
          Dernière connexion :{' '}
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString('fr-FR')
            : 'Jamais'}
        </div>
        <div>
          Groupes :{' '}
          {user.memberships.map((m) => m.group.name).join(', ') || '—'}
        </div>
        <div>Sessions actives : {user.sessions?.length ?? 0}</div>
        <div className="md:col-span-2">
          Mot de passe temporaire :{' '}
          {user.mustChangePassword ? (
            <span className="font-semibold text-amber-800">
              En attente de changement
              {user.tempPasswordSetAt
                ? ` (émis le ${new Date(user.tempPasswordSetAt).toLocaleString('fr-FR')})`
                : ''}
            </span>
          ) : (
            <span className="text-[var(--muted)]">Défini par l’utilisateur</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            if (
              !confirm(
                'Générer un nouveau mot de passe temporaire ? Les sessions actives seront révoquées.',
              )
            ) {
              return;
            }
            setBusy(true);
            setErr('');
            clearSecrets();
            try {
              const res = await api<{
                temporaryPassword: string;
                message: string;
              }>(`/users/${user.id}/temporary-password`, {
                method: 'POST',
                body: '{}',
              });
              setTempPassword(res.temporaryPassword);
              setMsg(res.message);
              await load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Régénérer mot de passe temporaire
        </button>
        <button
          type="button"
          className="btn-ghost border border-[var(--border)]"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            clearSecrets();
            try {
              const res = await api<{ invitationToken: string }>(
                `/users/${user.id}/resend-invitation`,
                { method: 'POST', body: '{}' },
              );
              setInviteToken(res.invitationToken);
              setMsg('Invitation renvoyée');
              await load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Réenvoyer invitation
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/users/${user.id}/suspend`, {
                method: 'POST',
                body: '{}',
              });
              setMsg('Accès suspendu — sessions révoquées');
              clearSecrets();
              await load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Suspendre
        </button>
        <button
          type="button"
          className="btn-ghost border border-[var(--border)]"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/users/${user.id}/reactivate`, {
                method: 'POST',
                body: '{}',
              });
              setMsg('Accès réactivé');
              await load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Réactiver
        </button>
        <button
          type="button"
          className="btn-ghost border border-[var(--border)]"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/users/${user.id}/revoke-sessions`, {
                method: 'POST',
                body: '{}',
              });
              setMsg('Sessions révoquées');
              await load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Révoquer sessions
        </button>
      </div>

      {(msg || err) && (
        <p className={`text-sm ${err ? 'text-rose-700' : 'text-action'}`}>
          {err || msg}
        </p>
      )}
      {tempPassword && (
        <SecretBox
          title="Nouveau mot de passe temporaire"
          value={tempPassword}
          hint="Copiez-le maintenant — il ne sera plus réaffichable après fermeture de cet onglet."
        />
      )}
      {inviteToken && (
        <SecretBox
          title="Token invitation"
          value={inviteToken}
          hint="Activer via /activate?token=…"
        />
      )}
    </div>
  );
}

function SecretBox({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="text-xs font-bold uppercase text-amber-900">{title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-2 py-1.5 text-sm font-semibold tracking-wide text-slate-900">
          {value}
        </code>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      {hint && <p className="mt-2 text-xs text-amber-900/80">{hint}</p>}
    </div>
  );
}
