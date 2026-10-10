'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Ancienne route — redirige vers Administration > Paramètres système */
export default function SettingsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/admin/settings');
  }, [router]);
  return (
    <div className="text-sm text-[var(--muted)]">
      Redirection vers Administration…
    </div>
  );
}
