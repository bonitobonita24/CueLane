// @ts-check

import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // projectService discovers tsconfig.json per-package (turbo runs lint per workspace).
        // allowDefaultProject covers root-level .mjs config files (eslint.config.mjs itself).
        projectService: {
          allowDefaultProject: ['*.mjs', '*.cjs', '*.js'],
          defaultProject: './tsconfig.base.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
    },
  },
);
