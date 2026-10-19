// Trusted, explicitly confirmed project bootstrap. Uses the owner's existing
// Firebase CLI session only for provisioning, never as the application identity.
// No token, private key, reset link or environment secret is printed.
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const project = process.env.FIREBASE_PROJECT_ID;
if (!project || process.env.CONFIRM_PROJECT !== project || process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error(
    'Set CONFIRM_PROJECT to the dedicated real FIREBASE_PROJECT_ID. Emulators must be off.',
  );
const owner = process.env.BOOTSTRAP_OWNER_EMAIL;
if (!owner)
  throw new Error('BOOTSTRAP_OWNER_EMAIL must identify the authorized Firebase CLI account.');
function cli(args) {
  const raw = execFileSync('./node_modules/.bin/firebase', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(raw.slice(raw.indexOf('{'))).result;
}
// This read verifies access and refreshes the CLI token if necessary.
cli(['apps:list', '--project', project, '--json']);
const account = cli(['login:list', '--json']).find((a) => a.user.email === owner);
if (!account) throw new Error('The expected Firebase CLI account is not authorized.');
const token = account.tokens.access_token;
async function request(url, method = 'GET', body, allowMissing = false) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (allowMissing && r.status === 404) return null;
  if (!r.ok)
    throw new Error(
      `${method} ${new URL(url).pathname}: ${r.status} ${data.error?.message || 'request failed'}`,
    );
  return data;
}
async function wait(url) {
  for (let i = 0; i < 90; i++) {
    const op = await request(url);
    if (op.error) throw new Error(op.error.message);
    if (op.done) return op.response;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Provisioning operation is still pending. Inspect its state before retrying.');
}
const cloudProject = await request(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`,
);
const billing = await request(
  `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,
);
console.log(
  'Verified target project:',
  project,
  'billing enabled:',
  billing.billingEnabled === true,
);
const service = `https://serviceusage.googleapis.com/v1/projects/${cloudProject.projectNumber}/services/firestore.googleapis.com`;
const state = await request(service);
if (state.state !== 'ENABLED') {
  const op = await request(`${service}:enable`, 'POST', {});
  if (op.name) await wait(`https://serviceusage.googleapis.com/v1/${op.name}`);
  console.log('Firestore API enabled; no billing change requested.');
}
let database;
for (let i = 0; i < 8; i++) {
  try {
    database = await request(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`,
      'GET',
      undefined,
      true,
    );
    break;
  } catch (e) {
    if (i === 7 || !e.message.includes('has not been used')) throw e;
    await new Promise((r) => setTimeout(r, 3000));
  }
}
if (!database) {
  const location = process.env.FIRESTORE_LOCATION || 'nam5';
  const op = await request(
    `https://firestore.googleapis.com/v1/projects/${project}/databases?databaseId=(default)`,
    'POST',
    { type: 'FIRESTORE_NATIVE', locationId: location },
  );
  if (op.name) await wait(`https://firestore.googleapis.com/v1/${op.name}`);
  console.log('Created default Firestore database:', location);
} else console.log('Existing database preserved:', database.locationId);
const accountId = 'stillvein-server';
const email = `${accountId}@${project}.iam.gserviceaccount.com`;
let sa = await request(
  `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`,
  'GET',
  undefined,
  true,
);
if (!sa)
  sa = await request(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`, 'POST', {
    accountId,
    serviceAccount: { displayName: 'STILLVEIN server - catalog and staff administration' },
  });
const policy = await request(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`,
  'POST',
  { options: { requestedPolicyVersion: 3 } },
);
const member = `serviceAccount:${email}`;
for (const role of ['roles/datastore.user', 'roles/firebaseauth.admin']) {
  let binding = policy.bindings.find((b) => b.role === role && !b.condition);
  if (!binding) {
    binding = { role, members: [] };
    policy.bindings.push(binding);
  }
  if (!binding.members.includes(member)) binding.members.push(member);
}
await request(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${project}:setIamPolicy`,
  'POST',
  { policy },
);
const directory = resolve('.secrets');
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const path = resolve(directory, 'stillvein-server.json');
if (!existsSync(path)) {
  const key = await request(`https://iam.googleapis.com/v1/${sa.name}/keys`, 'POST', {
    privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE',
    keyAlgorithm: 'KEY_ALG_RSA_2048',
  });
  writeFileSync(path, Buffer.from(key.privateKeyData, 'base64'), { mode: 0o600, flag: 'wx' });
  console.log('Dedicated server key saved to the ignored local secret directory.');
} else console.log('Existing local server key preserved.');
console.log('Server identity:', email, 'roles: datastore.user, firebaseauth.admin');
const after = await request(
  `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,
);
console.log('Final billing enabled:', after.billingEnabled === true);
