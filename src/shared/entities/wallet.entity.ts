import Decimal from 'decimal.js';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v7 as uuid } from 'uuid';
import { decimalTransformer } from '../utils/decimal.transformer';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({
    type: 'numeric',
    precision: 19,
    scale: 4,
    default: 0,
    transformer: decimalTransformer,
  })
  balance: Decimal;

  @Column({ default: 'BRL' })
  currency: string;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
