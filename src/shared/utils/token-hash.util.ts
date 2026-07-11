import { createHash } from 'crypto';

/** Hash determinístico (SHA-256) para tokens de alto entropia armazenados no banco. */
export function hashSecretToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex');
}
