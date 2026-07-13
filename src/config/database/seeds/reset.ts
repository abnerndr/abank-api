import 'dotenv/config';
import { clearDatabase } from './clear-database';
import { createSeedDataSource } from './seed-data-source';
import { runSeeds } from './run-seeds';

async function main() {
  const dataSource = createSeedDataSource();

  try {
    await dataSource.initialize();
    console.log('📦 Database connected successfully');

    await clearDatabase(dataSource);
    await runSeeds(dataSource);

    const users: Array<{ email: string }> = await dataSource.query(
      'SELECT email FROM users ORDER BY email',
    );
    console.log(`👥 Users after reset (${users.length}):`);
    for (const user of users) {
      console.log(`   - ${user.email}`);
    }

    await dataSource.destroy();
    console.log('✅ Database reset and seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

main();
