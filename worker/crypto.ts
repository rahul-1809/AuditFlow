import crypto from 'node:crypto';

const cachedKeys = new Map<string, Buffer>();

function getEncryptionKey(secret?: string): Buffer {
  const masterSecret = secret || 'AuditFlow_Internal_MasterKey_2026';
  if (!cachedKeys.has(masterSecret)) {
    const key = crypto.scryptSync(masterSecret, 'AuditFlow_Salt', 32);
    cachedKeys.set(masterSecret, key);
  }
  return cachedKeys.get(masterSecret)!;
}

/**
 * Hashes a user password using PBKDF2 with SHA-512 and unique salt
 */
export function hashPassword(plainPassword: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a candidate password against stored salt and hash
 */
export function verifyPassword(plainPassword: string, salt: string, storedHash: string): boolean {
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Encrypts a sensitive portal credential using AES-256-GCM
 */
export function encryptCredential(
  plainText: string,
  secret?: string
): { encrypted: string; iv: string; tag: string } {
  if (!plainText) return { encrypted: '', iv: '', tag: '' };
  const key = getEncryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypts a sensitive portal credential using AES-256-GCM
 */
export function decryptCredential(
  encryptedHex: string,
  ivHex: string,
  tagHex: string,
  secret?: string
): string {
  if (!encryptedHex) return '';
  try {
    const key = getEncryptionKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error('Decryption failure:', err?.message);
    return '••••••••';
  }
}
