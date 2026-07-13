import { CONFIG } from 'src/shared/constants/env';
import { DataSource } from 'typeorm';

const IS_LOCAL_DATABASE = /localhost|127\.0\.0\.1/.test(CONFIG.DATABASE_URL);

function assertSafeToReset(): void {
  if (CONFIG.NODE_ENV.toLowerCase().includes('production')) {
    throw new Error('Refusing to reset database while NODE_ENV is production.');
  }

  if (!CONFIG.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!IS_LOCAL_DATABASE && process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error(
      'Refusing to reset a non-local DATABASE_URL. Set ALLOW_DB_RESET=true to override.',
    );
  }
}

export async function clearDatabase(dataSource: DataSource): Promise<void> {
  assertSafeToReset();

  const tables: Array<{ tablename: string }> = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );

  const tableNames = tables
    .map((row) => row.tablename)
    .filter((name) => !name.startsWith('typeorm_'));

  if (tableNames.length === 0) {
    console.log('No tables found to truncate.');
    return;
  }

  const quotedTables = tableNames.map((name) => `"${name}"`).join(', ');
  await dataSource.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);

  const result = await dataSource.query<Array<{ count: string }>>(
    'SELECT COUNT(*)::text AS count FROM users',
  );
  const count = result[0]?.count ?? '0';

  if (count !== '0') {
    throw new Error(`Failed to clear users table (${count} rows remaining).`);
  }

  console.log(`🧹 Cleared ${tableNames.length} tables: ${tableNames.join(', ')}`);
}
