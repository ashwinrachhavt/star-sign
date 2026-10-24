export const theme = {
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
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "24px",
    6: "32px",
    7: "48px",
    8: "64px",
  },
  motion: {
    fast: "120ms",
    base: "200ms",
    slow: "320ms",
    ease: "cubic-bezier(0.2, 0, 0, 1)",
  },
} as const;

export type Theme = typeof theme;
