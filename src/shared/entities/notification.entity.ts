import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { NotificationType } from '../enums/notification.enum';

export interface TransferNotificationMetadata {
  fromUserEmail: string;
  amount: string;
  transactionId: string;
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb' })
  metadata: TransferNotificationMetadata;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
