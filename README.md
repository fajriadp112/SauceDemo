# SauceDemo - Playwright automation

Requires Node >= 18.

    npm install
    npx playwright install chromium
    npm test              # headless
    npm run test:headed   # watch the browser
    npm run report        # open the HTML report

Tests: `tests/login.spec.js`, `tests/checkout.spec.js` (E2E: Sauce Labs Onesie).
Page objects live in `pages/`. Credentials/product/customer data: `tests/data.js`.

## Report
After every run a summary (with each test step) prints in the console, and these are written:
- `report/report.html` - filterable results table with steps and errors (`npm run report` opens it)
- `report/results.json`
- `playwright-report/` - Playwright's built-in report with screenshots/video/trace (`npm run report:playwright`)
