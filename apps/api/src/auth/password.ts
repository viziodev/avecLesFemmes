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
