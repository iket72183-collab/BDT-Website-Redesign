import { defineConfig } from 'vitest/config';

/**
 * Minimal vitest setup for the API. `test.env` injects sensible defaults for
 * `config/env.ts` so importing it doesn't `process.exit(1)` during tests.
 * Individual test files mock `../../config/env.js` to override per-case.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'vitest-secret-which-is-comfortably-over-32-chars',
      STRIPE_SECRET_KEY: 'sk_test_unused',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_unused',
    },
  },
});
