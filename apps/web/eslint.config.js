// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2
//
// apps/web ESLint config — extends the root flat config and adds the
// accessibility plugin. Phase D's WCAG audit committed us to running
// jsx-a11y in CI for every PR, with errors not warnings — accessibility
// regressions get caught at the same gate as type errors.
//
// We don't extend the root config via import because flat-config import
// chains across workspaces hit "rules of hooks" style ordering bugs in
// ESLint 9.x. The root rules are duplicated minimally here; if they
// drift, sync this file.

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default [
  js.configs.recommended,

  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // TypeScript
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      // Imports
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',

      // General
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // Accessibility — full jsx-a11y recommended set, all errors
      ...jsxA11y.configs.recommended.rules,
    },
  },

  prettierConfig,
];
