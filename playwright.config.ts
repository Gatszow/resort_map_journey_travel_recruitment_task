import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Bookings live in server memory and are shared by every spec, so specs run one
  // at a time and each one books its own cabana with its own room.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm start -- --map map.ascii --bookings e2e/fixtures/bookings.json --port ${PORT}`,
    url: baseURL,
    // Never adopt a stray dev server: these specs depend on the fixture bookings above.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
