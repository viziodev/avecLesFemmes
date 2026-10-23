import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/mobile',
  outputDir: 'test-results/mobile',
  workers: 1,
  timeout: 30000,
  use: { baseURL: process.env.PWA_URL || 'http://localhost:8086', trace: 'retain-on-failure' },
  projects: [
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
  ],
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/mobile', open: 'never' }]],
});
