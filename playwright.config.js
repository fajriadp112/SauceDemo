// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [
    ['./reporters/summary-reporter.js', { outputDir: 'report' }], // console table + report/report.html + results.json
    ['html', { open: 'never' }],                                  // Playwright's own report (traces/screenshots)
  ],
  use: {
    baseURL: 'https://www.saucedemo.com',
    testIdAttribute: 'data-test', // saucedemo uses data-test, not data-testid
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
