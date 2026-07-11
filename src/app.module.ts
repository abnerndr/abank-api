import { Module } from '@nestjs/common';
import { DatabaseConfigModule } from './config/database/database.config';
import { MailModule } from './externals/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [DatabaseConfigModule, AuthModule, MailModule, UsersModule, RolesModule, WalletModule],
})
export class AppModule {}
