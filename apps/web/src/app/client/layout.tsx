import type { Metadata } from 'next';
import { ClientShell } from './components/ClientShell';

export const metadata: Metadata = {
  title: 'AUTOCAR OS — Espace client',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
