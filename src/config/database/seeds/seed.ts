import 'dotenv/config';
import { CONFIG } from 'src/shared/constants/env';
import { entities } from 'src/shared/entities';
import { DataSource } from 'typeorm';
import { seedRolesAndPermissions } from './role.seed';
import { seedTestWallets } from './wallet.seed';

async function runSeeds() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: CONFIG.DATABASE_URL,
    entities: entities,
    logging: ['query', 'error'],
    synchronize: false,
    ssl: CONFIG.NODE_ENV.toLowerCase().includes('production')
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    await dataSource.initialize();
    console.log('📦 Database connected successfully');

    await seedRolesAndPermissions(dataSource);
    await seedTestWallets(dataSource);

    await dataSource.destroy();
    console.log('✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running seeds:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

runSeeds();
