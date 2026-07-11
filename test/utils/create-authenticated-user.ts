import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { TokenService } from '../../src/modules/auth/services/token.service';
import { Role } from '../../src/shared/entities/role.entity';
import { User } from '../../src/shared/entities/user.entity';

export interface AuthenticatedTestUser {
  userId: string;
  email: string;
  accessToken: string;
}

export async function createAuthenticatedUser(
  app: INestApplication,
  options: { roles?: string[] } = {},
): Promise<AuthenticatedTestUser> {
  const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const rolesRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  const tokenService = app.get(TokenService);

  const roleNames = options.roles ?? [];
  const roles: Role[] = [];
  for (const name of roleNames) {
    const existing = await rolesRepository.findOne({ where: { name } });
    roles.push(
      existing ?? (await rolesRepository.save(rolesRepository.create({ name, description: name }))),
    );
  }

  const email = `wallet-test-${randomUUID()}@example.com`;
  const user = await usersRepository.save(usersRepository.create({ email, isVerified: true, roles }));
  const tokenPair = await tokenService.generateTokenPair(user.id, user.email, roleNames, []);

  return { userId: user.id, email: user.email, accessToken: tokenPair.access_token };
}
