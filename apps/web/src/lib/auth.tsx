'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, setToken } from './api';

export type Me = {
  id: string;
  email: string;
  displayName: string;
  companyId: string;
  depotIds: string[];
  isSuperAdmin: boolean;
  permissions: string[];
};

type AuthState = {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (perm: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>('/auth/me');
      setMe(data);
    } catch {
      setMe(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const res = await api<{ accessToken?: string; mfaRequired?: boolean }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, mfaCode }),
      },
    );
    if (res.mfaRequired) {
      throw Object.assign(new Error('Code MFA requis'), { mfaRequired: true });
    }
    if (!res.accessToken) throw new Error('Connexion refusée');
    setToken(res.accessToken);
    await refresh();
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken(null);
    setMe(null);
  };

  const can = (perm: string) =>
    !!me && (me.isSuperAdmin || me.permissions.includes(perm));

  return (
    <AuthContext.Provider value={{ me, loading, login, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
