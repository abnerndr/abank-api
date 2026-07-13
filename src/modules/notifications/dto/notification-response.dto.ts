import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../../../shared/enums/notification.enum';
import type { TransferNotificationMetadata } from '../../../shared/entities/notification.entity';

export class NotificationResponseDTO {
  @ApiProperty({ example: 'uuid-notification-id' })
  id: string;

  @ApiProperty({ enum: NotificationType, example: NotificationType.TRANSFER_RECEIVED })
  type: NotificationType;

  @ApiProperty({ example: 'Transferência recebida' })
  title: string;

  @ApiProperty({ example: 'Você recebeu R$ 50,00 de alice@abank.dev' })
  message: string;

  @ApiProperty({
    example: {
      fromUserEmail: 'alice@abank.dev',
      amount: '50.0000',
      transactionId: 'uuid-transaction-id',
    },
  })
  metadata: TransferNotificationMetadata;

  @ApiProperty({ example: null, nullable: true })
  readAt: Date | null;

  @ApiProperty({ example: '2026-07-13T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-08-27T12:00:00.000Z' })
  expiresAt: Date;
}

export class NotificationListResponseDTO {
  @ApiProperty({ type: [NotificationResponseDTO] })
  notifications: NotificationResponseDTO[];

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}

export class UnreadCountResponseDTO {
  @ApiProperty({ example: 3 })
  count: number;
}
