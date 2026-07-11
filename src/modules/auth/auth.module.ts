import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from 'src/externals/mail/mail.module';
import { CONFIG } from 'src/shared/constants/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { AbilitiesGuard } from './guards/abilities.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MagicLinkGuard } from './guards/magic-link.guard';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MagicLinkStrategy } from './strategies/magic-link.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: async () => ({
        secret: CONFIG.JWT.SECRET,
        signOptions: { expiresIn: CONFIG.JWT.EXPIRES_IN },
      }),
    }),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    CaslAbilityFactory,
    JwtStrategy,
    MagicLinkStrategy,
    MagicLinkGuard,
    AbilitiesGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, TokenService, CaslAbilityFactory, AbilitiesGuard],
})
export class AuthModule {}
