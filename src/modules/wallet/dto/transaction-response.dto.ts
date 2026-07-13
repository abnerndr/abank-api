import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../../../shared/enums/wallet.enum';

export class TransactionResponseDTO {
  @ApiProperty({ example: 'uuid-transaction-id' })
  id: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.TRANSFER })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @ApiProperty({ example: '50.0000' })
  amount: string;

  @ApiProperty({ example: 'uuid-wallet-id', nullable: true })
  fromWalletId: string | null;

  @ApiProperty({ example: 'uuid-wallet-id', nullable: true })
  toWalletId: string | null;

  @ApiProperty({ example: 'uuid-transaction-id', nullable: true })
  reversalOfId: string | null;

  @ApiProperty({ example: 'uuid-user-id' })
  requestedByUserId: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nullable: true })
  idempotencyKey: string | null;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({
    example: 'uuid-refund-request-id',
    nullable: true,
    description: 'ID da solicitação de estorno pendente, se existir',
  })
  pendingRefundRequestId: string | null;
}

export class TransactionListResponseDTO {
  @ApiProperty({ type: [TransactionResponseDTO] })
  transactions: TransactionResponseDTO[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class AdminTransactionResponseDTO extends TransactionResponseDTO {
  @ApiProperty({ example: 'alice@abank.dev', nullable: true })
  requestedByUserEmail: string | null;
}

export class AdminTransactionListResponseDTO {
  @ApiProperty({ type: [AdminTransactionResponseDTO] })
  transactions: AdminTransactionResponseDTO[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class AdminTransactionStatsResponseDTO {
  @ApiProperty({ example: 3, description: 'Solicitações de estorno pendentes' })
  pendingRefunds: number;

  @ApiProperty({ example: 42, description: 'Total de transações consideradas' })
  total: number;
}
