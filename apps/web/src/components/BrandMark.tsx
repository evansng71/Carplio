'use client';

type Props = {
  logoUrl?: string | null;
  brandName?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  tagline?: string | null;
  inverted?: boolean;
};

const sizes = {
  sm: { box: 'h-8 w-8', bar: 'h-5', word: 'text-base' },
  md: { box: 'h-11 w-11', bar: 'h-7', word: 'text-xl' },
  lg: { box: 'h-14 w-14', bar: 'h-9', word: 'text-2xl' },
};

export function BrandMark({
  logoUrl,
  brandName = 'AUTOCAR OS',
  size = 'md',
  showWordmark = true,
  tagline,
  inverted = false,
}: Props) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={brandName}
          className={`${s.box} rounded-xl object-contain`}
        />
      ) : (
        <div
          className={`${s.box} relative flex items-center justify-center rounded-xl ${
            inverted ? 'bg-white/15' : 'bg-action/10'
          }`}
          aria-hidden
        >
          <span
            className={`absolute -rotate-[18deg] ${s.bar} w-1.5 rounded-full bg-action`}
            style={{ left: '32%' }}
          />
          <span
            className={`absolute -rotate-[18deg] ${s.bar} w-1.5 rounded-full bg-[#3BA3E6]`}
            style={{ left: '52%' }}
          />
        </div>
      )}
      {showWordmark && (
        <div className="leading-tight">
          <div
            className={`font-bold tracking-tight ${s.word} ${
              inverted ? 'text-white' : 'text-night'
            }`}
          >
            {brandName}
          </div>
          {tagline && (
            <div
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                inverted ? 'text-white/70' : 'text-[var(--muted)]'
              }`}
            >
              {tagline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
