import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
let env: RulesTestEnvironment;
const enabled = process.env.TEST_EMULATORS === '1';
describe.skipIf(!enabled)('Firestore client isolation', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-stillvein-rules',
      firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
    });
  });
  afterAll(async () => {
    await env.cleanup();
  });
  it.each(['products', 'enquiries', 'users', 'assets', 'audit', 'settings'])(
    'denies public reads from %s',
    async (c) => {
      await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), c)));
    },
  );
  it('denies public role escalation', async () => {
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), 'users/attacker'), { role: 'admin' }),
    );
  });
  it('does not trust custom client role claims', async () => {
    const db = env.authenticatedContext('attacker', { role: 'admin', admin: true }).firestore();
    await assertFails(getDoc(doc(db, 'enquiries/private')));
    await assertFails(setDoc(doc(db, 'products/bad'), { status: 'published' }));
  });
  it('never exposes draft records directly', async () => {
    await assertFails(getDoc(doc(env.authenticatedContext('user').firestore(), 'products/draft')));
    expect(true).toBe(true);
  });
});
