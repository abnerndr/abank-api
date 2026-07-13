import * as bcrypt from 'bcryptjs';
import { Role, User } from 'src/shared/entities';
import { DataSource } from 'typeorm';

export const TEST_USERS = [
  {
    email: 'alice@abank.dev',
    password: 'Test123!',
    name: 'Alice Teste',
  },
  {
    email: 'bob@abank.dev',
    password: 'Test123!',
    name: 'Bob Teste',
  },
] as const;

export type TestUserEmail = (typeof TEST_USERS)[number]['email'];

export async function seedTestUsers(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);

  const userRole = await roleRepository.findOne({ where: { name: 'user' } });
  if (!userRole) {
    throw new Error('Role "user" not found — run seedRolesAndPermissions first');
  }

  for (const account of TEST_USERS) {
    const existing = await userRepository.findOne({
      where: { email: account.email },
      relations: ['roles'],
    });

    if (existing) {
      console.log(`⏭️  Skipping user ${account.email} (already exists)`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(account.password, 10);
    const user = userRepository.create({
      email: account.email,
      password: hashedPassword,
      name: account.name,
      isVerified: true,
      roles: [userRole],
    });
    await userRepository.save(user);
    console.log(`👤 Created test user: ${account.email}`);
  }

  console.log('✅ Test users seeded:');
  for (const account of TEST_USERS) {
    console.log(`   ${account.email} / ${account.password}`);
  }
}
