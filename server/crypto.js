import crypto from 'node:crypto';

// Encryption master key for portal credentials (32 bytes)
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.CREDENTIALS_SECRET || 'AuditFlow_Internal_MasterKey_2026',
  'AuditFlow_Salt',
  32
);

/**
 * Hashes a user password using PBKDF2 with SHA-512 and unique salt
 */
export function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verifies a candidate password against stored salt and hash
 */
export function verifyPassword(plainPassword, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Encrypts a sensitive portal credential using AES-256-GCM
 */
export function encryptCredential(plainText) {
  if (!plainText) return { encrypted: '', iv: '', tag: '' };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
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
export function decryptCredential(encryptedHex, ivHex, tagHex) {
  if (!encryptedHex) return '';
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failure:', err.message);
    return '••••••••';
  }
}
