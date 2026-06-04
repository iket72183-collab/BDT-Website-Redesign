import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Admin test runner. The only tests here cover the BFF Route Handlers under
 * `app/api/**` — the server-side proxy layer that reads the httpOnly admin
 * cookie and forwards authenticated requests to the main API. They run in a
 * node environment (no DOM) and mock `next/headers` + `fetch`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
  resolve: {
    // Mirror tsconfig `@/* -> ./*` so route handlers resolve `@/lib/auth`.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
