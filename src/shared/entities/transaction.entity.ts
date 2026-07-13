import Decimal from 'decimal.js';
import { BaseEntity, Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { TransactionStatus, TransactionType } from '../enums/wallet.enum';
import { decimalTransformer } from '../utils/decimal.transformer';

@Entity('transactions')
@Check(`"amount" > 0`)
@Index(['requestedByUserId', 'type', 'idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
@Index(['reversalOfId'], { unique: true, where: '"reversal_of_id" IS NOT NULL' })
export class Transaction extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Column({ type: 'numeric', precision: 19, scale: 4, transformer: decimalTransformer })
  amount: Decimal;

  @Index()
  @Column({ name: 'from_wallet_id', type: 'uuid', nullable: true })
  fromWalletId: string | null;

  @Index()
  @Column({ name: 'to_wallet_id', type: 'uuid', nullable: true })
  toWalletId: string | null;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId: string | null;

  @Index()
  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId: string;

  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
