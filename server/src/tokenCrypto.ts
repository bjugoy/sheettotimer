import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[tokenCrypto] TOKEN_ENCRYPTION_KEY is required in production');
    }
    // Deterministic dev fallback — never used in production
    return createHash('sha256').update('dev-only-not-secret').digest();
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('[tokenCrypto] TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)');
  }
  return key;
}

// Returns "iv.authTag.ciphertext" — all base64, dot-delimited
export function encryptTokens(tokens: { access_token: string | null; refresh_token: string | null }): string {
  const key    = getKey();
  const iv     = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plain  = JSON.stringify(tokens);
  const enc    = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptTokens(blob: string): { access_token: string | null; refresh_token: string | null } {
  const parts = blob.split('.');
  if (parts.length !== 3) throw new Error('Invalid token blob format');
  const [ivB64, tagB64, encB64] = parts;
  const key     = getKey();
  const iv      = Buffer.from(ivB64,  'base64');
  const tag     = Buffer.from(tagB64, 'base64');
  const enc     = Buffer.from(encB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plain = decipher.update(enc, undefined, 'utf8') + decipher.final('utf8');
  return JSON.parse(plain);
}
