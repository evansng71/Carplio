/** Same-origin `/api` (Next rewrite → Nest) avoids CORS / blocked :4000 in browser */
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export type ApiError = { message: string; reason?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    let body: ApiError = { message: res.statusText };
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(body.message || 'Erreur API'), {
      status: res.status,
      body,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('access_token', token);
  else localStorage.removeItem('access_token');
}

/** Fetch HTML (print templates) with auth and open in a new window. */
export async function openPrintHtml(path: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message || 'Impression impossible');
  }
  const html = await res.text();
  const w = window.open('', '_blank');
  if (!w) throw new Error('Autorisez les pop-ups pour imprimer');
  w.document.open();
  w.document.write(html);
  w.document.close();
}
