import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  projects: [
    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    launchOptions: {
      firefoxUserPrefs: {
        'webgl.force-enabled': true,
        'webgl.disabled': false,
      },
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
