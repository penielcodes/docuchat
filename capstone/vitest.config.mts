import { defineConfig } from 'vitest/config';

// Vitest configuration — tells it where to find tests, and what to
// include/exclude when calculating coverage percentages.
export default defineConfig({
  test: {
    globals: true,       // lets us use describe/it/expect without importing them every file
    environment: 'node', // we're testing a backend, not a browser
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/config/**'],
    },
  },
});