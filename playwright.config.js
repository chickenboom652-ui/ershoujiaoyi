import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:3107', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true, viewport: { width: 1440, height: 1100 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node server/index.js --demo', url: 'http://127.0.0.1:3107/api/health', reuseExistingServer: false, env: { PORT: '3107', DATA_DIR: 'data/e2e', UPLOAD_DIR: 'data/e2e/uploads' } }
});
