import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Playwright specs live in e2e/ and end in .spec.ts, so they stay out of here.
    include: ['server/**/*.test.ts', 'web/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
