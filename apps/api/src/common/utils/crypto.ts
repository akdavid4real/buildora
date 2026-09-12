import * as crypto from 'node:crypto';

/**
 * Generates an opaque, cryptographically secure random token (64 hex characters).
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes the SHA-256 hash of an opaque token for safe storage and indexing.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
