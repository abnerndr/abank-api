import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CONFIG } from 'src/shared/constants/env';
import { entities } from '../../shared/entities';

const IS_LOCAL_DATABASE = /localhost|127\.0\.0\.1/.test(CONFIG.DATABASE_URL);
const SHOULD_SYNCHRONIZE = CONFIG.NODE_ENV.toLowerCase().includes('development');

if (SHOULD_SYNCHRONIZE && !IS_LOCAL_DATABASE) {
  throw new Error(
    'Refusing to start with TypeORM synchronize enabled against a non-local DATABASE_URL. ' +
      'synchronize must only ever run against a local development database.',
  );
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: CONFIG.DATABASE_URL,
        entities: entities,
        logging: ['query', 'error'],
        synchronize: SHOULD_SYNCHRONIZE,
        ssl: CONFIG.NODE_ENV.toLowerCase().includes('production')
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseConfigModule {}
