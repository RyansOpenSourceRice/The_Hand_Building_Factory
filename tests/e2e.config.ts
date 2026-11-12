import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [
    ['list'],
    ['json', {outputFile: 'test-results/results.json'}],
  ],
  projects: [
    {
      name: 'firefox',
      use: {...devices['Desktop Firefox']},
    },
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome'], channel: 'chromium'},
    },
  ],
  use: {
    baseURL: 'http://localhost:4173',
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
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
