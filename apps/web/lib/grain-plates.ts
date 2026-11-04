/**
 * Grain chart imagery (design-system §6): original procedural SVG
 * "specimen" plates — organic shapes rendered grayscale with feTurbulence
 * film grain. These are Star Sign's own assets, generated from code; no
 * Co–Star assets are involved. One plate per planet + ascendant.
 */
import type { Planet } from "@star-sign/core";

export type GrainPlateId =
  | Planet
  | "ascendant"
  | "sun-leo"
  | "moon-scorpio";

/**
 * Deterministic plate per body. Seeded pseudo-random blob path + radial
 * texture; the shape differs by seed so each body has its own specimen.
 */
export function grainPlateSvg(seed: number, label: string): string {
  const rnd = mulberry32(seed);
  const cx = 100;
  const cy = 100;
  const points: string[] = [];
  const lobes = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2;
    const r = 42 + rnd() * 32;
    const x = (cx + Math.cos(angle) * r).toFixed(1);
    const y = (cy + Math.sin(angle) * r).toFixed(1);
    points.push(`${x},${y}`);
  }
  // Catmull-Rom-ish closed curve through the lobe points.
  const d = catmullClosed(points);
  const streakAngle = Math.floor(rnd() * 180);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <title>Star Sign chart plate: ${label}</title>
  <defs>
    <radialGradient id="body" cx="45%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#b9b7b2"/>
      <stop offset="55%" stop-color="#6d6b66"/>
      <stop offset="100%" stop-color="#141413"/>
    </radialGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0" result="alpha"/>
      <feComposite in="alpha" in2="SourceGraphic" operator="in" result="grainclip"/>
      <feBlend in="SourceGraphic" in2="grainclip" mode="multiply"/>
    </filter>
    <clipPath id="clip"><path d="${d}"/></clipPath>
  </defs>
  <g filter="url(#grain)">
    <path d="${d}" fill="url(#body)"/>
    <g clip-path="url(#clip)" opacity="0.55">
      <g transform="rotate(${streakAngle} 100 100)">
        ${streaks(rnd)}
      </g>
    </g>
    <path d="${d}" fill="none" stroke="#0d0d0d" stroke-opacity="0.6" stroke-width="1.5"/>
  </g>
</svg>`;
}

function streaks(rnd: () => number): string {
  let out = "";
  for (let i = 0; i < 26; i++) {
    const y = 20 + rnd() * 160;
    const w = 0.5 + rnd() * 1.6;
    const o = (0.15 + rnd() * 0.5).toFixed(2);
    out += `<rect x="${(10 + rnd() * 20).toFixed(1)}" y="${y.toFixed(1)}" width="160" height="${w.toFixed(2)}" fill="#e8e6e1" fill-opacity="${o}"/>`;
  }
  return out;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed smooth path through points (simple cardinal spline). */
function catmullClosed(pts: string[]): string {
  const p = pts.map((s) => s.split(",").map(Number) as [number, number]);
  const n = p.length;
  let d = `M ${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d + " Z";
}

const PLANET_SEEDS: Record<string, number> = {
  sun: 11,
  moon: 23,
  mercury: 37,
  venus: 41,
  mars: 53,
  jupiter: 67,
  saturn: 71,
  uranus: 83,
  neptune: 97,
  pluto: 101,
  ascendant: 7,
};

export function grainPlateDataUri(body: string): string {
  const seed = PLANET_SEEDS[body] ?? 5;
  const svg = grainPlateSvg(seed, body);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
