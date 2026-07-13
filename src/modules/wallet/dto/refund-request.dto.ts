import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RefundRequestStatus } from '../../../shared/enums/wallet.enum';
import { AdminTransactionResponseDTO } from './transaction-response.dto';

export class CreateRefundRequestDTO {
  @ApiPropertyOptional({ example: 'Valor creditado por engano', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RefundRequestQueryDTO {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    enum: RefundRequestStatus,
    description: 'Filtrar por status. Padrão: PENDING',
  })
  @IsOptional()
  @IsEnum(RefundRequestStatus)
  status?: RefundRequestStatus;

  @ApiPropertyOptional({
    example: 'wallet-test-',
    description: 'Excluir solicitações de usuários cujo e-mail começa com este prefixo',
  })
  @IsOptional()
  @IsString()
  excludeUserEmailPrefix?: string;
}

export class RefundRequestResponseDTO {
  @ApiProperty({ example: 'uuid-refund-request-id' })
  id: string;

  @ApiProperty({ example: 'uuid-transaction-id' })
  transactionId: string;

  @ApiProperty({ enum: RefundRequestStatus, example: RefundRequestStatus.PENDING })
  status: RefundRequestStatus;

  @ApiProperty({ example: 'uuid-user-id' })
  requestedByUserId: string;

  @ApiProperty({ example: 'alice@abank.dev', nullable: true })
  requestedByUserEmail: string | null;

  @ApiProperty({ example: 'Valor creditado por engano', nullable: true })
  reason: string | null;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-11T01:00:00.000Z', nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ example: 'uuid-admin-id', nullable: true })
  resolvedByUserId: string | null;

  @ApiProperty({ type: AdminTransactionResponseDTO })
  transaction: AdminTransactionResponseDTO;
}

export class RefundRequestListResponseDTO {
  @ApiProperty({ type: [RefundRequestResponseDTO] })
  refundRequests: RefundRequestResponseDTO[];

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
