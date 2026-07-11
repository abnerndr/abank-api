import { CONFIG } from '../../shared/constants/env';
import { allowedOrigins } from '../../shared/utils/allowed-origins';

export class CorsConfig {
  public static cors() {
    const raw = (CONFIG.CORS_ORIGIN ?? '*').trim();
    const origins = raw
      .split(',')
      .map((origin: string) => origin.trim())
      .filter(Boolean);

    const list = allowedOrigins(origins);
    const isDev = CONFIG.NODE_ENV.toLowerCase().includes('dev');
    const isProduction = CONFIG.NODE_ENV.toLowerCase() === 'production';

    const allowAllInDev =
      !isProduction && (raw === '*' || origins.includes('*') || !list.length || isDev);

    return {
      origin: allowAllInDev ? true : list,
      exposedHeaders: 'Authorization',
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'OPTIONS', 'POST', 'DELETE'],
    };
  }
}
