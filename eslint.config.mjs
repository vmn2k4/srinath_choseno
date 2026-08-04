import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next.js app: a bundled tool's own scripts, and Deno
    // runtime code (different globals/tsconfig) — neither should be linted
    // against this app's rules.
    ".claude/**",
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
