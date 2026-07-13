import { CONFIG } from 'src/shared/constants/env';
import { entities } from 'src/shared/entities';
import { DataSource } from 'typeorm';

export function createSeedDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    url: CONFIG.DATABASE_URL,
    entities,
    logging: ['query', 'error'],
    synchronize: false,
    ssl: CONFIG.NODE_ENV.toLowerCase().includes('production')
      ? { rejectUnauthorized: false }
      : false,
  });
}
