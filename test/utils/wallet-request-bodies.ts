import { randomUUID } from 'crypto';

export function uniqueIdempotencyKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function depositBody(amount: string, idempotencyKey?: string) {
  return {
    amount,
    idempotencyKey: idempotencyKey ?? uniqueIdempotencyKey('deposit'),
  };
}

export function transferBody(toEmail: string, amount: string, idempotencyKey?: string) {
  return {
    toEmail,
    amount,
    idempotencyKey: idempotencyKey ?? uniqueIdempotencyKey('transfer'),
  };
}
