import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryUserDTO {
  @ApiPropertyOptional({
    description: 'Página para paginação',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Quantidade de itens por página',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Buscar por nome ou email',
    example: 'João',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar apenas usuários verificados',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Excluir e-mails que começam com este prefixo (ex.: wallet-test-)',
    example: 'wallet-test-',
  })
  @IsOptional()
  @IsString()
  excludeEmailPrefix?: string;

  @ApiPropertyOptional({
    description: 'Ordenar por campo',
    example: 'createdAt',
    enum: ['name', 'email', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Direção da ordenação',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
