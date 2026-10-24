import { TextStyle } from "react-native";
import { tokens } from "./tokens";

/* Type system (design-system.md §3) — three voices, strict roles, RN mirrors
   of the web voices in apps/web/styles/type.css. Font families resolve once
   the faces are loaded via expo-font; the platform fallbacks keep the roles
   distinct until then. */

export const fontSerif = "Playfair Display";
export const fontSans = "Inter";
export const fontMono = "IBM Plex Mono";

export const serifDisplay: TextStyle = {
  fontFamily: fontSerif,
  fontWeight: "400",
};

export const sansProse: TextStyle = {
  fontFamily: fontSans,
  fontWeight: "300",
  lineHeight: undefined,
};

export const monoStructural: TextStyle = {
  fontFamily: fontMono,
  fontWeight: "400",
};

/* micro-label recipe: 11px caps, +0.08em tracking (RN letterSpacing is px) */
export const microLabel: TextStyle = {
  fontFamily: fontMono,
  fontWeight: "400",
  fontSize: tokens.type.s11,
  textTransform: "uppercase",
  letterSpacing: 0.88,
  lineHeight: 16,
};

/* web type scale 11/13/15/17/22/28/36, voice + size composed */
export const type = {
  s11: { fontSize: tokens.type.s11, lineHeight: 16 } as TextStyle,
  s13: { fontSize: tokens.type.s13, lineHeight: 20 } as TextStyle,
  s15: { fontSize: tokens.type.s15, lineHeight: 24 } as TextStyle,
  s17: { fontSize: tokens.type.s17, lineHeight: 28 } as TextStyle,
  s22: { fontSize: tokens.type.s22, lineHeight: 28 } as TextStyle,
  s28: { fontSize: tokens.type.s28, lineHeight: 32 } as TextStyle,
  s36: { fontSize: tokens.type.s36, lineHeight: 42 } as TextStyle,
};

export const colors = tokens.color;
export const space = tokens.space;
export const motion = tokens.motion;

/* 44px minimum touch target (design-system.md §8 accessibility floor) */
export const touchTarget = { minHeight: 44, minWidth: 44 };
