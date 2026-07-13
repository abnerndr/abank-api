import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { FastifyReply } from 'fastify';
import { MailService } from 'src/externals/mail/mail.service';
import { CONFIG } from 'src/shared/constants/env';
import { Permission } from 'src/shared/entities/permission.entity';
import { Role } from 'src/shared/entities/role.entity';
import { TokenPair } from 'src/shared/interfaces/jwt-token';
import { User } from '../../shared/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDTO } from './dto/login.dto';
import { MagicLinkDTO } from './dto/magic-link.dto';
import { MessageResponseDTO } from './dto/message.dto';
import { NewPasswordDTO } from './dto/new-password.dto';
import { RefreshTokenDTO } from './dto/refresh-token.dto';
import { RegisterDTO } from './dto/register.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { VerifyEmailDTO } from './dto/verify-email.dto';
import { TokenService } from './services/token.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
    private mailService: MailService,
  ) {}

  async register(registerDto: RegisterDTO): Promise<MessageResponseDTO> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      verificationToken,
    });

    try {
      await this.mailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      await this.usersService.deleteUser(user.id);
      throw error;
    }

    return {
      message: 'Registration successful. Check your email for verification.',
    };
  }

  async login(loginDto: LoginDTO): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    return this.generateTokens(user);
  }

  async sendMagicLink(magicLinkDto: MagicLinkDTO): Promise<MessageResponseDTO> {
    let user = await this.usersService.findByEmail(magicLinkDto.email);

    if (!user) {
      user = await this.usersService.create({
        email: magicLinkDto.email,
        isVerified: true,
      });
    }

    const magicLinkToken = crypto.randomBytes(32).toString('hex');
    const magicLinkExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.usersService.update(user.id, {
      magicLinkToken,
      magicLinkExpires,
    });

    await this.mailService.sendMagicLink(user.email, magicLinkToken);

    return { message: 'Magic link sent to your email' };
  }

  async loginWithMagicLink(token: string): Promise<TokenPair> {
    const user = await this.usersService.findByMagicLinkToken(token);

    if (!user || !user.magicLinkExpires || user.magicLinkExpires < new Date()) {
      throw new BadRequestException('Invalid or expired magic link');
    }

    // Marca o usuário como verificado e limpa o magic link token
    await this.usersService.updateMagicLinkToken(user.id, undefined, undefined);

    await this.usersService.update(user.id, {
      isVerified: true,
    });

    return this.generateTokens(user);
  }

  async verifyMagicLink(token: string): Promise<TokenPair> {
    const user = await this.usersService.findByMagicLinkToken(token);

    if (!user || user.magicLinkExpires < new Date()) {
      throw new BadRequestException('Invalid or expired magic link');
    }

    await this.usersService.update(user.id, {
      magicLinkToken: undefined,
      magicLinkExpires: undefined,
      isVerified: true,
    });

    return this.generateTokens(user);
  }

  async loginWithUser(user: User): Promise<TokenPair> {
    await this.usersService.updateMagicLinkToken(user.id, undefined, undefined);

    await this.usersService.update(user.id, {
      isVerified: true,
    });

    return this.generateTokens(user);
  }

  async loginWithUserId(userId: string): Promise<TokenPair> {
    const user = await this.usersService.findByIdWithRoles(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.updateMagicLinkToken(user.id, undefined, undefined);

    await this.usersService.update(user.id, {
      isVerified: true,
    });

    return this.generateTokens(user);
  }

  async forgotPassword(resetPasswordDto: ResetPasswordDTO): Promise<MessageResponseDTO> {
    const user = await this.usersService.findByEmail(resetPasswordDto.email);

    if (!user) {
      return { message: 'If email exists, reset link will be sent' };
    }

    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.usersService.update(user.id, {
      resetPasswordToken,
      resetPasswordExpires,
    });

    await this.mailService.sendPasswordReset(user.email, resetPasswordToken);

    return { message: 'If email exists, reset link will be sent' };
  }

  async resetPassword(newPasswordDto: NewPasswordDTO): Promise<MessageResponseDTO> {
    const user = await this.usersService.findByResetToken(newPasswordDto.token);

    if (!user || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPasswordDto.password, 10);

    await this.usersService.update(user.id, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    return { message: 'Password reset successful' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDTO): Promise<MessageResponseDTO> {
    const user = await this.usersService.findByVerificationToken(verifyEmailDto.token);

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.usersService.update(user.id, {
      isVerified: true,
      verificationToken: undefined,
    });

    return { message: 'Email verified successfully' };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDTO): Promise<TokenPair> {
    const user = await this.usersService.findByRefreshToken(refreshTokenDto.refreshToken);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(user);
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const roles = user.roles?.map((role: Role) => role.name) || [];
    const permissions =
      user.roles?.flatMap((role: Role) =>
        role.permissions?.map(
          (permission: Permission) => `${permission.resource}:${permission.action}`,
        ),
      ) || [];

    const tokenPair = await this.tokenService.generateTokenPair(
      user.id,
      user.email,
      roles,
      permissions,
    );

    await this.usersService.update(user.id, {
      refreshToken: tokenPair.refresh_token,
    });

    return { ...tokenPair };
  }

  async logout(userId: string) {
    await this.usersService.update(userId, { refreshToken: undefined });
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findByIdWithRoles(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      roles: user.roles || [],
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  setCookieOnly(response: FastifyReply, accessToken: string, refreshToken: string) {
    const isProduction = CONFIG.NODE_ENV === 'production';
    const cookieOptions = `HttpOnly; ${isProduction ? 'Secure' : ''}`;

    response.header('Set-Cookie', [
      `access_token=${accessToken}; ${cookieOptions}`,
      `refresh_token=${refreshToken}; ${cookieOptions}`,
    ]);
  }
}
