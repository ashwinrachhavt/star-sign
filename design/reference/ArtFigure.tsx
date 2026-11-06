'use client';

/**
 * ArtFigure — grainy B&W collage fragment that floats between reading cards.
 * The generated assets already sit on pure black, so they melt into the void
 * without any blend tricks.
 */
export function ArtFigure({
  src,
  alt,
  className = '',
  drift = true,
  opacity = 0.92,
}: {
  src: string;
  alt: string;
  className?: string;
  drift?: boolean;
  opacity?: number;
}) {
  return (
    <div className={`pointer-events-none relative select-none ${className}`} aria-hidden={alt === ''}>
      <img
        src={`/art/${src}.png`}
        alt={alt}
        draggable={false}
        style={{ opacity }}
        className={`h-auto w-full object-contain mix-blend-lighten ${drift ? 'art-drift' : ''}`}
      />
    </div>
  );
}
