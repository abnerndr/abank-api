import { ApiProperty } from '@nestjs/swagger';
import { AdminTransactionListResponseDTO } from './transaction-response.dto';
import { WalletResponseDTO } from './wallet-response.dto';

export class AdminWalletItemDTO extends WalletResponseDTO {
  @ApiProperty({ example: 'uuid-user-id' })
  userId: string;

  @ApiProperty({ example: 'alice@abank.dev' })
  userEmail: string;

  @ApiProperty({ example: 'Alice Teste', nullable: true })
  userName: string | null;
}

export class AdminWalletListResponseDTO {
  @ApiProperty({ type: [AdminWalletItemDTO] })
  wallets: AdminWalletItemDTO[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class AdminUserWalletResponseDTO extends WalletResponseDTO {
  @ApiProperty({ example: 'uuid-user-id' })
  userId: string;

  @ApiProperty({ example: 'alice@abank.dev' })
  userEmail: string;

  @ApiProperty({ example: 'Alice Teste', nullable: true })
  userName: string | null;
}

export { AdminTransactionListResponseDTO } from './transaction-response.dto';
