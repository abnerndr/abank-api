import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { FindManyOptions, In, Like, Not, Repository } from 'typeorm';
import { Role } from '../../shared/entities/role.entity';
import { User } from '../../shared/entities/user.entity';
import { ChangePasswordDTO } from './dto/change-password.dto copy';
import { CreateUserDTO } from './dto/create-user.dto';
import { QueryUserDTO } from './dto/query-user.dto';
import { UserListResponseDTO } from './dto/response-user.dto';
import { UpdateUserDTO } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async validUser(email: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { email },
    });
    return !!user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findByIdWithRoles(id: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });

    return user;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { verificationToken: token },
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { resetPasswordToken: token },
    });
  }

  async findByMagicLinkToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { magicLinkToken: token },
    });
  }

  async findByRefreshToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { refreshToken: token },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findByIdWithRoles(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    // Handle many-to-many relationships separately
    const { roles, ...simpleUpdateData } = updateData;

    // Update simple fields first
    if (Object.keys(simpleUpdateData).length > 0) {
      await this.usersRepository.update(id, simpleUpdateData);
    }

    // Handle roles relationship if provided
    if (roles !== undefined) {
      user.roles = roles;
      await this.usersRepository.save(user);
    }

    // Return updated user
    const updatedUser = await this.findByIdWithRoles(id);
    if (!updatedUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return updatedUser;
  }

  async createUser(createUserDto: CreateUserDTO): Promise<User> {
    // Verificar se email já existe
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email já está em uso');
    }

    // Hash da senha se fornecida
    let hashedPassword: string | undefined;
    if (createUserDto.password) {
      hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    }

    // Criar usuário
    const userData: Partial<User> = {
      email: createUserDto.email,
      password: hashedPassword,
      name: createUserDto.name,
      avatar: createUserDto.avatar,
      googleId: createUserDto.googleId,
    };

    // Adicionar roles se fornecidas
    if (createUserDto.roleIds && createUserDto.roleIds.length > 0) {
      const roles = await this.findRolesByIds(createUserDto.roleIds);
      userData.roles = roles;
    }

    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async updateUser(id: string, updateUserDto: UpdateUserDTO): Promise<User> {
    // Verificar se usuário existe
    const existingUser = await this.findByIdWithRoles(id);
    if (!existingUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se novo email já está em uso
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const userWithEmail = await this.findByEmail(updateUserDto.email);
      if (userWithEmail) {
        throw new ConflictException('Email já está em uso');
      }
    }

    const updateData: Partial<User> = {
      email: updateUserDto.email,
      name: updateUserDto.name,
      avatar: updateUserDto.avatar,
      isVerified: updateUserDto.isVerified,
    };

    // Atualizar roles se fornecidas
    if (updateUserDto.roleIds) {
      const roles = await this.findRolesByIds(updateUserDto.roleIds);
      updateData.roles = roles;
    }

    return this.update(id, updateData);
  }

  async findAll(queryDto: QueryUserDTO): Promise<UserListResponseDTO> {
    const {
      page = 1,
      limit = 10,
      search,
      isVerified,
      excludeEmailPrefix,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const baseWhere: Record<string, unknown> = {};

    if (isVerified !== undefined) {
      baseWhere.isVerified = isVerified;
    }

    if (excludeEmailPrefix) {
      baseWhere.email = Not(Like(`${excludeEmailPrefix}%`));
    }

    const queryOptions: FindManyOptions<User> = {
      relations: ['roles'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    };

    if (search) {
      queryOptions.where = [
        { ...baseWhere, name: Like(`%${search}%`) },
        { ...baseWhere, email: Like(`%${search}%`) },
      ];
    } else {
      queryOptions.where = baseWhere;
    }

    const [users, total] = await this.usersRepository.findAndCount(queryOptions);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.findByIdWithRoles(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.usersRepository.find({
      where: { id: In(ids) },
    });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.remove(user);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDTO): Promise<void> {
    const user = await this.findById(userId);

    if (!user.password) {
      throw new BadRequestException('Usuário não possui senha definida');
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    // Hash da nova senha
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Atualizar senha
    await this.update(userId, { password: hashedNewPassword });
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.update(userId, { password: hashedPassword });
  }

  async verifyUser(userId: string): Promise<User> {
    return this.update(userId, {
      isVerified: true,
      verificationToken: undefined,
    });
  }

  async getUserStats(excludeEmailPrefix?: string): Promise<{
    total: number;
    verified: number;
    unverified: number;
    withGoogle: number;
  }> {
    const applyExclusion = (qb: ReturnType<Repository<User>['createQueryBuilder']>) => {
      if (excludeEmailPrefix) {
        qb.andWhere('user.email NOT LIKE :excludePrefix', {
          excludePrefix: `${excludeEmailPrefix}%`,
        });
      }
      return qb;
    };

    const total = await applyExclusion(this.usersRepository.createQueryBuilder('user')).getCount();
    const verified = await applyExclusion(
      this.usersRepository.createQueryBuilder('user').andWhere('user.isVerified = :verified', {
        verified: true,
      }),
    ).getCount();
    const unverified = await applyExclusion(
      this.usersRepository.createQueryBuilder('user').andWhere('user.isVerified = :verified', {
        verified: false,
      }),
    ).getCount();
    const withGoogle = await applyExclusion(
      this.usersRepository
        .createQueryBuilder('user')
        .andWhere('user.googleId IS NOT NULL'),
    ).getCount();

    return {
      total,
      verified,
      unverified,
      withGoogle,
    };
  }

  async updateMagicLinkToken(
    userId: string,
    magicLinkToken: string | undefined,
    magicLinkExpires: Date | undefined,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      magicLinkToken,
      magicLinkExpires,
    });
  }

  // Método auxiliar para buscar roles por IDs
  private async findRolesByIds(roleIds: string[]): Promise<Role[]> {
    if (!roleIds || roleIds.length === 0) {
      return [];
    }

    const roles = await this.rolesRepository.find({
      where: { id: In(roleIds) },
      relations: ['permissions'],
    });

    if (roles.length !== roleIds.length) {
      throw new NotFoundException('Uma ou mais roles não foram encontradas');
    }

    return roles;
  }
}
