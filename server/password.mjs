import {scrypt, timingSafeEqual, randomBytes} from 'node:crypto';

// OWASP's 16 MiB scrypt profile, compatible with the Worker memory limit.
const options = {N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024};
const derive = (password, salt) => new Promise((resolve, reject) => {
  scrypt(password.normalize('NFC'), salt, 32, options, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const key = await derive(password, salt);
  return `scrypt$16384$8$5$${salt}$${key.toString('base64url')}`;
}
export async function verifyPassword(password, stored) {
  const parts = stored?.split('$');
  const valid = parts?.length === 6 && parts.slice(0,4).join('$') === 'scrypt$16384$8$5';
  const salt = valid ? parts[4] : 'papaye-dummy-salt';
  const actual = await derive(password, salt);
  const expected = valid ? Buffer.from(parts[5], 'base64url') : Buffer.alloc(32);
  return expected.length === actual.length && timingSafeEqual(actual, expected) && !!valid;
}
