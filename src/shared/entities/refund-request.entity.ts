import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { RefundRequestStatus } from '../enums/wallet.enum';

@Entity('refund_requests')
@Index(['transactionId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
export class RefundRequest extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Index()
  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId: string;

  @Column({ type: 'enum', enum: RefundRequestStatus, default: RefundRequestStatus.PENDING })
  status: RefundRequestStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId: string | null;
}
