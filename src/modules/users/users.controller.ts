import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateUsers,
  DeleteUsers,
  ReadUsers,
  UpdateUsers,
} from '../auth/decorators/check-abilities.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AbilitiesGuard } from '../auth/guards/abilities.guard';

import { UsersService } from './users.service';
// import { AuthGuard } from '../auth/auth.guard';
import { plainToInstance } from 'class-transformer';
import { ChangePasswordDTO } from './dto/change-password.dto copy';
import { CreateUserDTO } from './dto/create-user.dto';
import { QueryUserDTO } from './dto/query-user.dto';
import { UserListResponseDTO, UserResponseDTO } from './dto/response-user.dto';
import { UpdateUserDTO } from './dto/update-user.dto';

@ApiTags('Users')
@Controller('api/users')
// @UseGuards(AuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @CreateUsers()
  @UseGuards(AbilitiesGuard)
  @ApiOperation({ summary: 'Criar novo usuário' })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado com sucesso',
    type: UserResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'Email já está em uso' })
  async create(@Body() createUserDto: CreateUserDTO): Promise<UserResponseDTO> {
    const user = await this.usersService.createUser(createUserDto);
    return plainToInstance(UserResponseDTO, user, {
      excludeExtraneousValues: false,
    });
  }

  @Get()
  @ReadUsers()
  @UseGuards(AbilitiesGuard)
  @ApiOperation({ summary: 'Listar usuários com paginação e filtros' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuários',
    type: UserListResponseDTO,
  })
  @ApiQuery({ name: 'page', required: false, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por nome' })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    description: 'Filtrar por verificação',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Campo para ordenação',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Direção da ordenação',
  })
  async findAll(@Query() queryDto: QueryUserDTO): Promise<UserListResponseDTO> {
    const result = await this.usersService.findAll(queryDto);
    return {
      ...result,
      data: result.data.map((user) =>
        plainToInstance(UserResponseDTO, user, {
          excludeExtraneousValues: false,
        }),
      ),
    };
  }

  @Get('stats')
  @ReadUsers()
  @UseGuards(AbilitiesGuard)
  @ApiOperation({ summary: 'Estatísticas dos usuários' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas dos usuários',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        verified: { type: 'number' },
        unverified: { type: 'number' },
        withGoogle: { type: 'number' },
      },
    },
  })
  async getStats() {
    return this.usersService.getUserStats();
  }

  @Get('me')
  @ApiOperation({ summary: 'Obter perfil do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil do usuário',
    type: UserResponseDTO,
  })
  async getProfile(@CurrentUser() userData: CurrentUserData): Promise<UserResponseDTO> {
    const user = await this.usersService.findById(userData.id);
    return plainToInstance(UserResponseDTO, user, {
      excludeExtraneousValues: false,
    });
  }

  @Put('me')
  @ApiOperation({ summary: 'Atualizar perfil do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil atualizado com sucesso',
    type: UserResponseDTO,
  })
  async updateProfile(
    @CurrentUser() userData: CurrentUserData,
    @Body() updateUserDto: UpdateUserDTO,
  ): Promise<UserResponseDTO> {
    const user = await this.usersService.updateUser(userData.id, updateUserDto);
    return plainToInstance(UserResponseDTO, user, {
      excludeExtraneousValues: false,
    });
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Alterar senha do usuário logado' })
  @ApiResponse({
    status: 204,
    description: 'Senha alterada com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Senha atual incorreta' })
  async changePassword(
    @CurrentUser() userData: CurrentUserData,
    @Body() changePasswordDto: ChangePasswordDTO,
  ): Promise<void> {
    await this.usersService.changePassword(userData.id, changePasswordDto);
  }

  @Get(':id')
  @ReadUsers()
  @UseGuards(AbilitiesGuard)
  @ApiOperation({ summary: 'Obter usuário por ID' })
  @ApiParam({ name: 'id', description: 'ID do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário encontrado',
    type: UserResponseDTO,
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async findOne(@Param('id') id: string): Promise<UserResponseDTO> {
    const user = await this.usersService.findById(id);
    return plainToInstance(UserResponseDTO, user, {
      excludeExtraneousValues: false,
    });
  }

  @Put(':id')
  @UpdateUsers()
  @UseGuards(AbilitiesGuard)
  @ApiOperation({ summary: 'Atualizar usuário por ID' })
  @ApiParam({ name: 'id', description: 'ID do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário atualizado com sucesso',
    type: UserResponseDTO,
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 409, description: 'Email já está em uso' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDTO,
  ): Promise<UserResponseDTO> {
    const user = await this.usersService.updateUser(id, updateUserDto);
    return plainToInstance(UserResponseDTO, user, {
      excludeExtraneousValues: false,
    });
  }

  @Delete(':id')
  @DeleteUsers()
  @UseGuards(AbilitiesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletar usuário por ID' })
  @ApiParam({ name: 'id', description: 'ID do usuário' })
  @ApiResponse({
    status: 204,
    description: 'Usuário deletado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.usersService.deleteUser(id);
  }

  @Put(':id/verify')
  @UpdateUsers()
  @UseGuards(AbilitiesGuard)
  @ApiOperation({ summary: 'Verificar usuário manualmente' })
  @ApiParam({ name: 'id', description: 'ID do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Usuário verificado com sucesso',
    type: UserResponseDTO,
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async verifyUser(@Param('id') id: string): Promise<UserResponseDTO> {
    const user = await this.usersService.verifyUser(id);
    return plainToInstance(UserResponseDTO, user, {
      excludeExtraneousValues: false,
    });
  }

  @Patch(':id/password')
  @UpdateUsers()
  @UseGuards(AbilitiesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Definir nova senha para usuário' })
  @ApiParam({ name: 'id', description: 'ID do usuário' })
  @ApiResponse({
    status: 204,
    description: 'Senha definida com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async setPassword(@Param('id') id: string, @Body() body: { password: string }): Promise<void> {
    await this.usersService.setPassword(id, body.password);
  }
}
