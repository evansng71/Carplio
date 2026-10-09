'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { me, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    router.replace(me ? '/app' : '/login');
  }, [me, loading, router]);
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
      Chargement AUTOCAR OS…
    </div>
  );
}
