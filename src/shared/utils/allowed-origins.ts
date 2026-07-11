/** Normaliza origem e inclui par localhost ↔ 127.0.0.1 (mesma porta), comuns em dev. */
export function allowedOrigins(origins: string[]): string[] {
  const out = new Set<string>();
  for (const o of origins) {
    const base = o.replace(/\/$/, '');
    out.add(base);
    try {
      const u = new URL(base);
      if (u.hostname === 'localhost') {
        out.add(`${u.protocol}//127.0.0.1${u.port ? `:${u.port}` : ''}`);
      }
      if (u.hostname === '127.0.0.1') {
        out.add(`${u.protocol}//localhost${u.port ? `:${u.port}` : ''}`);
      }
    } catch {
      /* ignora entrada inválida */
    }
  }
  return [...out];
}
