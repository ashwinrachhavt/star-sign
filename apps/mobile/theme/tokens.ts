/* Star Sign design tokens — mobile mirror of apps/web/styles/tokens.css
   (single source documented in `.agents/design-system.md`; keep values identical). */

export const tokens = {
  color: {
    bg: "#0d0d0d",
    ink: "#e8e6e1",
    inkSecondary: "#8f8d88",
    inkTertiary: "#5a5854",
    hairline: "#2e2d2b",
    cardBg: "transparent",
    danger: "#b3401f",
    light: {
      bg: "#f7f6f3",
      ink: "#111110",
      inkSecondary: "#6d6b66",
      inkTertiary: "#a3a19c",
      hairline: "#d8d6d1",
    },
  },
  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
    7: 48,
    8: 64,
  },
  motion: {
    fast: 120,
    base: 200,
    slow: 320,
    ease: [0.2, 0, 0, 1] as const,
  },
} as const;

export type Tokens = typeof tokens;
