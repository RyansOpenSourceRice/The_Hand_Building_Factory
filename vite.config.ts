import {defineConfig} from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
