import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {FlatCompat} from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
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
    ...compat.extends('google'),
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
        'require-jsdoc': 'off',
        'valid-jsdoc': 'off',
        'no-unused-vars': 'off',
        'new-cap': ['error', {newIsCap: true, capIsNew: false}],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
        ],
      },
    },
);
