#!/usr/bin/env node
// Generate the "client secret" JWT that Supabase wants in the
// Apple provider's "Secret Key (for OAuth)" field.
//
// Usage:
//   node scripts/gen-apple-jwt.mjs <path-to-AuthKey_XXXX.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>
//
// Example:
//   node scripts/gen-apple-jwt.mjs ~/Downloads/AuthKey_ABC123DEFG.p8 A1B2C3D4E5 ABC123DEFG com.familycal.app.signin
//
// The JWT is valid for ~6 months (Apple's max). Re-run before expiry.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , keyPath, teamId, keyId, servicesId] = process.argv;

if (!keyPath || !teamId || !keyId || !servicesId) {
  console.error(
    'Usage: node scripts/gen-apple-jwt.mjs <path-to-.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>',
  );
  process.exit(1);
}

const privateKey = readFileSync(resolve(keyPath), 'utf8');

const now = Math.floor(Date.now() / 1000);
const SIX_MONTHS = 60 * 60 * 24 * 30 * 6;

const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = {
  iss: teamId,
  iat: now,
  exp: now + SIX_MONTHS,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
};

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const signingInput = `${b64(header)}.${b64(payload)}`;

const signer = createSign('SHA256');
signer.update(signingInput);
signer.end();

// Apple uses raw r||s (JOSE) encoding, not DER. dsaEncoding requires Node >= 14.
const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
const jwt = `${signingInput}.${signature.toString('base64url')}`;

console.log(jwt);
