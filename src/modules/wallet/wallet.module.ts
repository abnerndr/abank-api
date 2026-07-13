import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from '../../shared/entities/ledger-entry.entity';
import { RefundRequest } from '../../shared/entities/refund-request.entity';
import { Transaction } from '../../shared/entities/transaction.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { WalletController } from './wallet.controller';
import { AdminWalletController } from './admin-wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, LedgerEntry, RefundRequest]),
    UsersModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
