import { defineConfig } from 'vitest/config';

// `tests/` holds Playwright browser specs (see playwright.config.ts) — they
// use @playwright/test's own test runner, not Vitest, so Vitest must not
// try to collect them. Real unit tests (pure logic, no DOM/browser) live
// alongside their source as `*.test.ts`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'tests/**', 'dist'],
    passWithNoTests: true,
  },
});
