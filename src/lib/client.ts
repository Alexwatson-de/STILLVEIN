'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
let auth: Auth | undefined;
export function clientAuth() {
  if (auth) return auth;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId)
    throw new Error(
      'Firebase sign-in is not configured. Set the public Firebase web configuration.',
    );
  const app =
    getApps()[0] ||
    initializeApp({
      apiKey,
      projectId,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL)
    connectAuthEmulator(auth, process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL, {
      disableWarnings: true,
    });
  return auth;
}
export async function api<T>(path: string, options: RequestInit = {}, admin = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (admin) {
    const user = clientAuth().currentUser;
    if (!user) throw new Error('Please sign in.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  const response = await fetch(`/api/${path}`, { ...options, headers, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result as T;
}
export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
