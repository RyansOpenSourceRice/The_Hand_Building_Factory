import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {FlatCompat} from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

// eslint-config-google 0.14.0 references core rules that ESLint 10 removed,
// and ESLint rejects unknown rules even when disabled, so drop them.
const REMOVED_IN_ESLINT_10 = new Set(['require-jsdoc', 'valid-jsdoc']);
const google = compat.extends('google').map((config) => {
  if (!config.rules) {
    return config;
  }
  const rules = {...config.rules};
  for (const rule of REMOVED_IN_ESLINT_10) {
    delete rules[rule];
  }
  return {...config, rules};
});

export default tseslint.config(
    {
      ignores: [
        'dist/**',
        'node_modules/**',
        'coverage/**',
        'playwright-report/**',
        'test-results/**',
      ],
    },
    js.configs.recommended,
    ...google,
    tseslint.configs.recommended,
    {
      files: ['**/*.ts', '**/*.js'],
      languageOptions: {
        globals: {
          ...globals.browser,
        },
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
      },
      rules: {
        'no-unused-vars': 'off',
        'new-cap': ['error', {newIsCap: true, capIsNew: false}],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
        ],
      },
    },
    {
      files: ['scripts/**/*.mjs'],
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.nodeBuiltin,
        },
      },
    },
);
