export type Branding = {
  brandName: string;
  brandTagline: string;
  loginHeadline: string;
  loginSubheadline: string;
  loginFooterText: string;
  logoUrl: string | null;
  loginHeroImageUrl: string;
  companyName: string;
  tradeName: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  isDemo: boolean;
};

export const FALLBACK_BRANDING: Branding = {
  brandName: 'AUTOCAR OS',
  brandTagline: 'TRANSPORT VOYAGEURS',
  loginHeadline: 'Pilotez vos exploitations en toute sérénité',
  loginSubheadline:
    'Une solution complète pour planifier, exploiter et optimiser votre activité de transport de voyageurs.',
  loginFooterText: 'Gestion d’exploitation transport voyageurs',
  logoUrl: null,
  loginHeroImageUrl: '/branding/login-hero-default.svg',
  companyName: 'AUTOCAR OS',
  tradeName: null,
  siret: null,
  vatNumber: null,
  isDemo: true,
};

export async function fetchBranding(): Promise<Branding> {
  try {
    const res = await fetch('/api/org/branding', { cache: 'no-store' });
    if (!res.ok) return FALLBACK_BRANDING;
    return (await res.json()) as Branding;
  } catch {
    return FALLBACK_BRANDING;
  }
}

/** Lit un fichier image en data-URL (max ~1.5 Mo). */
export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Fichier image requis'));
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      reject(new Error('Image trop lourde (max 1,5 Mo)'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture impossible'));
    reader.readAsDataURL(file);
  });
}
