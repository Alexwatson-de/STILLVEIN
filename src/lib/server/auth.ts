import { NextRequest } from 'next/server';
import { services, AppError } from './firebase';
import { Role } from '../schema';
export type Actor = { uid: string; role: Role; email: string };
export function can(role: Role, area: 'catalog' | 'enquiries' | 'settings' | 'users' | 'audit') {
  return (
    role === 'admin' ||
    (role === 'editor' && area === 'catalog') ||
    (role === 'sales' && area === 'enquiries')
  );
}
export async function requireUser(
  req: NextRequest,
  area?: Parameters<typeof can>[1],
): Promise<Actor> {
  const bearer = req.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) throw new AppError(401, 'Sign in to continue.');
  const { auth, db } = services();
  let token;
  try {
    token = await auth.verifyIdToken(bearer.slice(7), true);
  } catch {
    throw new AppError(401, 'Your session has expired. Sign in again.');
  }
  const user = (await db.collection('users').doc(token.uid).get()).data();
  if (!user?.active || !['admin', 'editor', 'sales'].includes(user.role))
    throw new AppError(403, 'This account has no administrative access.');
  const actor = { uid: token.uid, role: user.role as Role, email: token.email || '' };
  if (area && !can(actor.role, area))
    throw new AppError(403, 'Your role cannot perform this action.');
  return actor;
}
export function verifyOrigin(req: NextRequest) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
  if (origin && origin !== expected)
    throw new AppError(403, 'Cross-origin requests are not allowed.');
}
