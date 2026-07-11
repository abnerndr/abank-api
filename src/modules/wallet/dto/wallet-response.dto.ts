import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDTO {
  @ApiProperty({ example: 'uuid-wallet-id' })
  id: string;

  @ApiProperty({ example: '150.0000' })
  balance: string;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  updatedAt: Date;
}
