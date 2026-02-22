import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_KEY_LENGTH = 64;

function parseHash(storedHash: string): { salt: string; hash: string } {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    throw new Error('Некорректный формат password_hash');
  }
  return { salt, hash };
}

export function hashPassword(password: string): string {
  const normalized = password.trim();
  if (normalized.length < 8) {
    throw new Error('Пароль должен содержать минимум 8 символов');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(normalized, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const normalized = password.trim();
  if (!normalized) {
    return false;
  }
  const { salt, hash } = parseHash(storedHash);
  const calculated = scryptSync(normalized, salt, SCRYPT_KEY_LENGTH);
  const source = Buffer.from(hash, 'hex');
  if (source.length !== calculated.length) {
    return false;
  }
  return timingSafeEqual(source, calculated);
}
