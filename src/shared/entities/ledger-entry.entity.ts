import Decimal from 'decimal.js';
import { BaseEntity, Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { LedgerDirection } from '../enums/wallet.enum';
import { decimalTransformer } from '../utils/decimal.transformer';

@Entity('ledger_entries')
@Check(`"amount" > 0`)
export class LedgerEntry extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Index()
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction: LedgerDirection;

  @Column({ type: 'numeric', precision: 19, scale: 4, transformer: decimalTransformer })
  amount: Decimal;

  @Column({
    name: 'balance_after',
    type: 'numeric',
    precision: 19,
    scale: 4,
    transformer: decimalTransformer,
  })
  balanceAfter: Decimal;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
