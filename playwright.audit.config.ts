import mobile from './playwright.mobile.config';
import { defineConfig } from '@playwright/test';
// Deliberately separate from regression tests: captures the current audit findings.
export default defineConfig({
  ...mobile,
  testDir: './tests/audit',
  outputDir: 'test-results/audit',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/audit', open: 'never' }]],
});
