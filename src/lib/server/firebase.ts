import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function services() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId)
    throw new AppError(
      503,
      'Firebase is not configured. Set FIREBASE_PROJECT_ID and server credentials, or start the documented local emulators.',
    );
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.ALLOW_LOCAL_PRODUCTION_TEST &&
    (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
  )
    throw new AppError(503, 'Emulators are disabled in production.');
  if (
    (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
    !projectId.startsWith('demo-')
  )
    throw new AppError(503, 'Emulator project IDs must start with demo-.');
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    initializeApp({
      projectId,
      ...(process.env.FIRESTORE_EMULATOR_HOST
        ? {}
        : { credential: json ? cert(JSON.parse(json)) : applicationDefault() }),
    });
  }
  return { db: getFirestore(), auth: getAuth() };
}
