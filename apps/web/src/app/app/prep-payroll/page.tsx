'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Prépaye retirée — la paie se gère directement via les bulletins RH. */
export default function PrepPayrollRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/hr/payroll');
  }, [router]);
  return (
    <p className="text-sm text-[var(--muted)]">
      Redirection vers Paie & bulletins…
    </p>
  );
}
