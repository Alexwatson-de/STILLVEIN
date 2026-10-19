import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
if (
  !process.env.FIREBASE_PROJECT_ID ||
  process.env.CONFIRM_PROJECT !== process.env.FIREBASE_PROJECT_ID ||
  process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error(
    'Live sample testing requires CONFIRM_PROJECT matching the real configured project and no emulator settings.',
  );
export default defineConfig({
  testDir: './live-tests',
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 30000 },
  retries: 0,
  outputDir: 'test-results/live-samples',
  reporter: [['list']],
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'live-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
      },
    },
  ],
});
