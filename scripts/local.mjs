// Process-scoped overrides keep local testing separate from any .env.local
// credentials supplied by the owner. This script never rewrites environment files.
import { spawn } from 'node:child_process';
const command = process.argv[2] || 'dev';
const commands = {
  dev: ['next', 'dev', '--webpack', '--hostname', '0.0.0.0'],
  seed: ['tsx', 'scripts/seed.ts'],
  admin: ['tsx', 'scripts/provision-admin.ts'],
  build: ['next', 'build', '--webpack'],
  start: ['next', 'start', '--hostname', '0.0.0.0'],
};
if (!commands[command]) throw new Error('Choose dev, seed, admin, build or start.');
const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-stillvein',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-stillvein.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-stillvein',
  FIREBASE_PROJECT_ID: 'demo-stillvein',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  // Local QA must never spend live Cloudinary credits or mutate real assets.
  CLOUDINARY_CLOUD_NAME: '',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
  CLOUDINARY_UPLOAD_PRESET: '',
  CLOUDINARY_URL: '',
  RATE_LIMIT_SECRET: 'local-emulator-only-not-a-production-secret-change-before-deployment',
  TRUST_PROXY: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
  ...(['build', 'start'].includes(command) ? { ALLOW_LOCAL_PRODUCTION_TEST: '1' } : {}),
};
const child = spawn('npx', commands[command], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
