import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
// Explicit demo environments only. No shared PIN exists without a configured demo password.
export function demoPin(password: string) {
  if (!password || password.length < 12) throw new Error('Mot de passe de démonstration requis.');
  return (BigInt('0x' + digest('alf:demo-pin:' + password)) % 10000n).toString().padStart(4, '0');
}

// Domain separation: this capability never unwraps the offline vault.
export function offlineSigningKey(vaultSecret: string) {
  return createHmac('sha256', Buffer.from(vaultSecret, 'hex'))
    .update('alf:offline-signing:v1')
    .digest('hex');
}
export function offlineSignature(key: string, login: string, path: string, payload: string) {
  return createHmac('sha256', Buffer.from(key, 'hex'))
    .update(JSON.stringify(['alf:offline:v1', login, path, payload]))
    .digest('hex');
}
