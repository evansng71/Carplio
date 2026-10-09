'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'groups' | 'matrix' | 'audits' | 'test'>(
    'users',
  );
  const [users, setUsers] = useState<unknown[]>([]);
  const [groups, setGroups] = useState<
    Array<{
      id: string;
      name: string;
      key: string;
      permissions: Array<{
        denied: boolean;
        scope: string;
        permission: { key: string; label: string };
      }>;
    }>
  >([]);
  const [perms, setPerms] = useState<Array<{ key: string; label: string }>>([]);
  const [audits, setAudits] = useState<unknown[]>([]);
  const [test, setTest] = useState({
    userId: '',
    module: 'hr',
    resource: 'sensitive',
    action: 'read',
    depotId: '',
  });
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    api<unknown[]>('/users').then((u) => {
      setUsers(u);
      const first = (u as Array<{ id: string }>)[0];
      if (first) setTest((t) => ({ ...t, userId: first.id }));
    });
    api<typeof groups>('/groups').then(setGroups);
    api<Array<{ key: string; label: string }>>('/permissions').then(setPerms);
    api<unknown[]>('/audits?limit=30').then(setAudits);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Administration — Sécurité</h1>
        <p className="text-sm text-[var(--muted)]">
          Utilisateurs, groupes, matrice, audits, test de permissions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['users', 'Utilisateurs'],
            ['groups', 'Groupes'],
            ['matrix', 'Matrice'],
            ['audits', 'Audit'],
            ['test', 'Tester'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="card overflow-auto p-2">
          <pre className="max-h-[480px] overflow-auto text-xs">
            {JSON.stringify(users, null, 2)}
          </pre>
        </div>
      )}

      {tab === 'groups' && (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="font-semibold">
                {g.name} <span className="text-[var(--muted)]">({g.key})</span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {g.permissions.length} permissions
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'matrix' && (
        <div className="card overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-night/5">
              <tr>
                <th className="px-3 py-2">Permission</th>
                {groups.map((g) => (
                  <th key={g.id} className="px-2 py-2">
                    {g.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.slice(0, 40).map((p) => (
                <tr key={p.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{p.label}</td>
                  {groups.map((g) => {
                    const gp = g.permissions.find((x) => x.permission.key === p.key);
                    return (
                      <td key={g.id} className="px-2 py-2 text-center">
                        {!gp ? '·' : gp.denied ? '✕' : '✓'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audits' && (
        <div className="card overflow-auto p-2">
          <pre className="max-h-[480px] overflow-auto text-xs">
            {JSON.stringify(audits, null, 2)}
          </pre>
        </div>
      )}

      {tab === 'test' && (
        <div className="card space-y-3 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Utilisateur</label>
              <select
                className="input"
                value={test.userId}
                onChange={(e) => setTest({ ...test, userId: e.target.value })}
              >
                {(users as Array<{ id: string; email: string }>).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">module / resource / action</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={test.module}
                  onChange={(e) => setTest({ ...test, module: e.target.value })}
                />
                <input
                  className="input"
                  value={test.resource}
                  onChange={(e) => setTest({ ...test, resource: e.target.value })}
                />
                <input
                  className="input"
                  value={test.action}
                  onChange={(e) => setTest({ ...test, action: e.target.value })}
                />
              </div>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={async () => {
              const r = await api<{ allowed: boolean; reason: string }>(
                '/permissions/test',
                { method: 'POST', body: JSON.stringify(test) },
              );
              setTestResult(`${r.allowed ? 'AUTORISÉ' : 'REFUSÉ'} — ${r.reason}`);
            }}
          >
            Tester
          </button>
          {testResult && <p className="text-sm font-semibold">{testResult}</p>}
        </div>
      )}
    </div>
  );
}
