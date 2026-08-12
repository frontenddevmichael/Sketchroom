import { defineConfig } from 'playwright/test';

// Smoke tests for the Sketchroom harness (`npm run test:smoke`).
//
// The webServer boots the harness Vite server on :5199 (or reuses one that is
// already running), serving both the room-chrome harness and the full-app
// view (`/harness.html?view=app`) that the specs drive.
export default defineConfig({
  testDir: './smoke',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx vite --config dev/vite.config.ts --port 5199 --strictPort',
    cwd: '..',
    url: 'http://localhost:5199/harness.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
