'use client';

import { BODY_GLYPH, type Body } from '@/lib/our-sky/data';

/**
 * OrbitMini — the little transit diagram from the reference web site:
 * dashed orbit, earth at center, transiting + natal glyphs joined by an
 * aspect ray, type label hugging the circle.
 */
export function OrbitMini({
  transiting,
  natal,
  type,
  size = 96,
}: {
  transiting: Body;
  natal: Body;
  type: string;
  size?: number;
}) {
  const R = 44;
  // fixed, art-directed angles (visual prop, not ephemeris)
  const aT = -38; // transiting glyph, upper right
  const aN = 152; // natal glyph, lower left
  const pos = (a: number): [number, number] => {
    const rad = (a * Math.PI) / 180;
    return [50 + R * Math.cos(rad), 50 + R * Math.sin(rad)];
  };
  const [x1, y1] = pos(aT);
  const [x2, y2] = pos(aN);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="shrink-0">
      <circle cx={50} cy={50} r={R} fill="none" stroke="#3a3a3a" strokeWidth={0.6} strokeDasharray="2 2.6" />
      <circle cx={50} cy={50} r={R - 14} fill="none" stroke="#242424" strokeWidth={0.5} />
      <circle cx={50} cy={50} r={3.2} fill="#d6d6d3" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5a5a5a" strokeWidth={0.6} />
      <text x={x1} y={y1} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#f2f2f0">
        {BODY_GLYPH[transiting]}
      </text>
      <text x={x2} y={y2} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#8a8a8a">
        {BODY_GLYPH[natal]}
      </text>
      <text
        x={50}
        y={50 - R + 0.5}
        textAnchor="middle"
        dominantBaseline="auto"
        fontSize={4.6}
        letterSpacing={1.4}
        fill="#6a6a6a"
        style={{ fontFamily: 'var(--font-plex-mono)' }}
      >
        {type}
      </text>
    </svg>
  );
}
