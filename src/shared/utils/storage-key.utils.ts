import { ForbiddenException } from '@nestjs/common';

const PATH_TRAVERSAL = /\.\./;

/** Prefixo padrão de objetos pertencentes ao usuário no R2. */
export function buildUserScopedKey(userId: string, fileKey: string): string {
  const sanitized = fileKey.replace(/^\/+/, '').trim();
  if (!sanitized || PATH_TRAVERSAL.test(sanitized)) {
    throw new ForbiddenException('Chave de arquivo inválida');
  }
  if (sanitized.startsWith(`users/${userId}/`)) {
    return sanitized;
  }
  return `users/${userId}/${sanitized}`;
}

/**
 * Valida que a chave pertence ao usuário (prefixo users/{id}/ ou avatar fixo).
 */
export function assertUserOwnsStorageKey(userId: string, key: string): void {
  const trimmed = key.trim();
  if (!trimmed || PATH_TRAVERSAL.test(trimmed)) {
    throw new ForbiddenException('Chave de arquivo inválida');
  }

  const allowed =
    trimmed.startsWith(`users/${userId}/`) ||
    trimmed === `avatars/${userId}` ||
    trimmed.startsWith(`avatars/${userId}.`);

  if (!allowed) {
    throw new ForbiddenException('Acesso negado ao arquivo');
  }
}
