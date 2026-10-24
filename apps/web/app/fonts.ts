import { IBM_Plex_Mono, Inter, Playfair_Display } from "next/font/google";

/* Three voices, strict roles (design-system.md §3):
   serif → display/headlines/numerals only;
   sans  → reading prose only (300/400);
   mono  → labels, nav, data, handles, glyphs only.
   next/font self-hosts these at build time — no runtime CDN requests. */

export const fontSerif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-serif",
  display: "swap",
});

export const fontSans = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-sans",
  display: "swap",
});

export const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
