import type { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { LedgerEntry } from './ledger-entry.entity';
import { Notification } from './notification.entity';
import { RefundRequest } from './refund-request.entity';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

export const entities: EntityClassOrSchema[] = [
  Permission,
  Role,
  User,
  Wallet,
  Transaction,
  LedgerEntry,
  Notification,
  RefundRequest,
];
export {
  LedgerEntry,
  Notification,
  Permission,
  RefundRequest,
  Role,
  Transaction,
  User,
  Wallet,
};
