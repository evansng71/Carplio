'use client';

import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
      <div className="card max-w-md space-y-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-night">Mot de passe oublié</h1>
        <p className="text-sm text-[var(--muted)]">
          Pour réinitialiser votre accès, contactez un administrateur de votre
          société. La réinitialisation en libre-service arrivera dans une
          prochaine version.
        </p>
        <Link href="/login" className="btn-primary inline-flex">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
