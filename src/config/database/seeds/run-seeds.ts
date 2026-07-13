import { DataSource } from 'typeorm';
import { seedRolesAndPermissions } from './role.seed';
import { seedTestUsers } from './user.seed';
import { seedTestWallets } from './wallet.seed';

export async function runSeeds(dataSource: DataSource): Promise<void> {
  await seedRolesAndPermissions(dataSource);
  await seedTestUsers(dataSource);
  await seedTestWallets(dataSource);
}
