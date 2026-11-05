// W4 lint wiring: the CI lint gate previously covered only apps/mobile.
// Next.js flat config via FlatCompat (eslint-config-next 15 ships legacy
// format; Next docs bless this bridge).
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals"),
];

export default config;
