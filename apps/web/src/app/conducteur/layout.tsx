import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'AUTOCAR OS — Portail conducteur',
  manifest: '/conducteur/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'AUTOCAR Conducteur' },
};

export const viewport: Viewport = {
  themeColor: '#0B1F33',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[var(--bg)]">{children}</div>
  );
}
