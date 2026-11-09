import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 4610);

// Real-browser smoke tests for layout bugs that happy-dom cannot see (overlapping bars,
// overflow, hidden buttons). Run `npm run build` first: the server serves the built site.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ponsel-360', use: { viewport: { width: 360, height: 740 }, hasTouch: true } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'node e2e/server.mjs',
    url: `http://127.0.0.1:${port}/`,
    env: { E2E_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
