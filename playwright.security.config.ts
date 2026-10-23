import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/security',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 30000,
  outputDir: 'test-results/security',
  reporter: 'list',
  use: {
    baseURL: process.env.PWA_URL || 'http://localhost:8086',
    trace: 'off',
    serviceWorkers: 'block',
    ...devices['Pixel 7'],
  },
});
