import 'dotenv/config';
import { clearDatabase } from './clear-database';
import { createSeedDataSource } from './seed-data-source';

async function main() {
  const dataSource = createSeedDataSource();

  try {
    await dataSource.initialize();
    console.log('📦 Database connected successfully');

    await clearDatabase(dataSource);

    await dataSource.destroy();
    console.log('✅ Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

main();
