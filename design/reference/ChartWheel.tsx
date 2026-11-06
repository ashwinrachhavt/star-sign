'use client';

import { motion } from 'framer-motion';
import { CHART, ASC, ASPECTS, SIGN_ORDER, BODY_GLYPH, type Body } from '@/lib/our-sky/data';

/**
 * ChartWheel — hand-built SVG natal wheel in the reference style:
 * zodiac ring with mono sign labels, radiating house lines, planet glyphs,
 * and aspect chords (solid = trine/opposition, dashed = minor).
 *
 * Zodiac runs counterclockwise; ASC pinned to the 9-o'clock axis.
 */

const SIGN_LON: Record<string, number> = {
  Aries: 0, Taurus: 30, Gemini: 60, Cancer: 90, Leo: 120, Virgo: 150,
  Libra: 180, Scorpio: 210, Sagittarius: 240, Capricorn: 270, Aquarius: 300, Pisces: 330,
};

export const lonOf = (sign: string, deg: number) => (SIGN_LON[sign] ?? 0) + deg;

// Placidus-flavoured cusps for the demo chart (ASC Cancer 5°12', MC Pisces 18°24')
const CUSPS = [95.2, 118, 142, 168.4, 193, 218, 278.4, 298, 322, 348.4, 20, 57];

interface WheelProps {
  size?: number;           // css px
  showAspects?: boolean;
  animate?: boolean;
  dim?: boolean;           // lower contrast (used behind overlays)
  glyphScale?: number;
  className?: string;
}

export function ChartWheel({
  size = 300,
  showAspects = true,
  animate = false,
  dim = false,
  glyphScale = 1,
  className = '',
}: WheelProps) {
  const ascLon = lonOf(ASC.sign, ASC.deg);
  const R = 100;
  const rRingOut = 100;
  const rRingIn = 86;
  const rGlyph = 76;
  const rHouseIn = 30;

  const screenAngle = (lon: number) => 180 - (lon - ascLon); // svg degrees (y-down)
  const pt = (lon: number, r: number): [number, number] => {
    const a = (screenAngle(lon) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  };

  const ink = dim ? '#8a8a8a' : '#f2f2f0';
  const line = '#2f2f2f';
  const ringFill = '#0a0a0a';

  // planet glyph longitudes with collision nudge
  const glyphs = CHART.map(p => ({ ...p, lon: lonOf(p.sign, p.deg) })).sort((a, b) => a.lon - b.lon);
  for (let i = 1; i < glyphs.length; i++) {
    if (glyphs[i].lon - glyphs[i - 1].lon < 9) glyphs[i].lon = glyphs[i - 1].lon + 9;
  }
  if (glyphs.length > 1 && glyphs[0].lon + 360 - glyphs[glyphs.length - 1].lon < 9) {
    glyphs[0].lon = glyphs[glyphs.length - 1].lon + 9 - 360;
  }

  const glyphAt = new Map<Body, [number, number]>();
  CHART.forEach(p => {
    const g = glyphs.find(g0 => g0.body === p.body)!;
    glyphAt.set(p.body, pt(g.lon, rGlyph * 0.92));
  });

  const aspectColor = '#5a5a5a';

  const Group = animate
    ? (motion.g as unknown as React.FC<React.SVGProps<SVGGElement> & { initial?: object; animate?: object; transition?: object }>)
    : 'g' as unknown as React.FC<React.SVGProps<SVGGElement>>;

  return (
    <svg
      viewBox="-105 -105 210 210"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Natal chart wheel"
    >
      <Group
        {...(animate
          ? {
              initial: { opacity: 0, rotate: -40 },
              animate: { opacity: 1, rotate: 0 },
              transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
            }
          : {})}
        style={{ transformOrigin: '0px 0px' }}
      >
        {/* ring band */}
        <circle cx={0} cy={0} r={rRingOut} fill={ringFill} stroke={line} strokeWidth={0.7} />
        <circle cx={0} cy={0} r={rRingIn} fill="none" stroke={line} strokeWidth={0.7} />

        {/* sign labels */}
        {SIGN_ORDER.map(sign => {
          const mid = SIGN_LON[sign] + 15;
          const [x, y] = pt(mid, (rRingOut + rRingIn) / 2);
          let rot = screenAngle(mid) + 90;
          const s = ((screenAngle(mid) % 360) + 360) % 360;
          if (s > 0 && s < 180) rot += 180; // keep right-side-up
          return (
            <g key={sign} transform={`translate(${x} ${y}) rotate(${rot})`}>
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={6.2}
                letterSpacing={1.1}
                fill={dim ? '#6a6a6a' : '#b0b0ad'}
                style={{ fontFamily: 'var(--font-plex-mono)' }}
              >
                {sign.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* sign dividers */}
        {SIGN_ORDER.map(sign => {
          const [x1, y1] = pt(SIGN_LON[sign], rRingIn);
          const [x2, y2] = pt(SIGN_LON[sign], rRingOut);
          return (
            <line key={sign} x1={x1} y1={y1} x2={x2} y2={y2} stroke={line} strokeWidth={0.5} />
          );
        })}

        {/* house lines */}
        {CUSPS.map((c, i) => {
          const [x1, y1] = pt(c, rHouseIn);
          const [x2, y2] = pt(c, rRingIn);
          const major = i === 0 || i === 9;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={major ? '#8a8a8a' : line}
              strokeWidth={major ? 1 : 0.6}
            />
          );
        })}

        {/* inner circle */}
        <circle cx={0} cy={0} r={rHouseIn} fill="none" stroke={line} strokeWidth={0.5} />

        {/* aspect chords */}
        {showAspects &&
          ASPECTS.map((a, i) => {
            const p1 = glyphAt.get(a.a);
            const p2 = glyphAt.get(a.b);
            if (!p1 || !p2) return null;
            const solid = a.type === 'trine' || a.type === 'opposition';
            return (
              <line
                key={i}
                x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]}
                stroke={aspectColor}
                strokeWidth={0.7}
                strokeDasharray={solid ? undefined : '2 2.4'}
                opacity={0.85}
              />
            );
          })}

        {/* center: earth */}
        <circle cx={0} cy={0} r={2.2} fill={ink} />
        <line x1={0} y1={2.2} x2={0} y2={6} stroke={ink} strokeWidth={0.7} />
        <line x1={-2} y1={4.4} x2={2} y2={4.4} stroke={ink} strokeWidth={0.7} />

        {/* planet glyphs */}
        {glyphs.map(p => {
          const [x, y] = pt(p.lon, rGlyph);
          const [tx1, ty1] = pt(p.lon, rGlyph + 3);
          const [tx2, ty2] = pt(p.lon, rRingIn - 1);
          return (
            <g key={p.body}>
              <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke={dim ? '#5a5a5a' : '#8a8a8a'} strokeWidth={0.55} />
              <text
                x={x} y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11 * glyphScale}
                fill={ink}
              >
                {BODY_GLYPH[p.body]}
              </text>
            </g>
          );
        })}

        {/* ASC / MC markers */}
        {[95.2, 348.4].map((c, i) => {
          const [x, y] = pt(c, rRingOut + 0.5);
          return (
            <text
              key={i}
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={5}
              fill="#6a6a6a"
              style={{ fontFamily: 'var(--font-plex-mono)' }}
            >
              {i === 0 ? 'ASC' : 'MC'}
            </text>
          );
        })}
      </Group>
    </svg>
  );
}
