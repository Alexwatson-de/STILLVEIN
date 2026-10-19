import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { services } from '../src/lib/server/firebase';
async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error('Set ADMIN_EMAIL to the approved initial administrator email.');
  const { db, auth } = services();
  if (!(await db.collection('users').where('role', '==', 'admin').limit(1).get()).empty)
    throw new Error('An administrator already exists. Use authorized staff management instead.');
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if ((e as { code: string }).code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({
      email,
      ...(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.ADMIN_PASSWORD
        ? { password: process.env.ADMIN_PASSWORD }
        : {}),
    });
  }
  await db
    .doc(`users/${user.uid}`)
    .set({ email, role: 'admin', active: true, createdAt: new Date().toISOString() });
  await db
    .collection('audit')
    .add({
      actor: 'trusted-provisioning-script',
      action: 'user.bootstrap',
      target: user.uid,
      at: new Date().toISOString(),
    });
  console.log(
    `Administrator provisioned: ${email}. Use Firebase password reset to establish a production password; no default password is created.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
