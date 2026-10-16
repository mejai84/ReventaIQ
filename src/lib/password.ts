import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || salt === undefined || hash === undefined) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
