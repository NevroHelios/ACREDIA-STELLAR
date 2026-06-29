import eslint from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      "@typescript-eslint/no-explicit-any": "error",
      // TODO: Restrict all raw console calls to prevent direct bypass of debug/structured logger.
      // Configure "no-console": ["error", { allow: [] }] (allow: [] bans warn/error as well).
      // A file override should be defined to allow console.* calls ONLY inside src/lib/debug.ts.
      "no-console": ["error", { allow: ["warn", "error"] }]
    },
  },
  {
    ignores: [
      ".next/",
      "node_modules/",
      "dist/",
      "build/",
    ]
  }
);
