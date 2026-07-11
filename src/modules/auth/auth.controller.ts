import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { TokenPair } from 'src/shared/interfaces/jwt-token';
import { UserResponseDTO } from '../users/dto/response-user.dto';
import { AuthService } from './auth.service';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponseDTO } from './dto/auth.dto';
import { LoginDTO } from './dto/login.dto';
import { MagicLinkDTO, MagicLinkLoginDTO } from './dto/magic-link.dto';
import { MessageResponseDTO } from './dto/message.dto';
import { NewPasswordDTO } from './dto/new-password.dto';
import { RefreshTokenDTO } from './dto/refresh-token.dto';
import { RegisterDTO } from './dto/register.dto';
import { ResetPasswordDTO } from './dto/reset-password.dto';
import { VerifyEmailDTO } from './dto/verify-email.dto';
import { MagicLinkGuard } from './guards/magic-link.guard';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiBody({ type: RegisterDTO })
  @ApiResponse({
    status: 201,
    description: 'Usuário registrado com sucesso',
    type: AuthResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async register(@Body() registerDto: RegisterDTO): Promise<MessageResponseDTO> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login com email e senha' })
  @ApiBody({ type: LoginDTO })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    type: AuthResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(
    @Body() loginDto: LoginDTO,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<TokenPair> {
    const authResponse = await this.authService.login(loginDto);
    this.authService.setCookieOnly(response, authResponse.access_token, authResponse.refresh_token);
    return authResponse;
  }

  @Public()
  @Post('magic-link')
  @ApiBody({ type: MagicLinkDTO })
  @ApiOperation({ summary: 'Enviar magic link por email' })
  @ApiResponse({
    status: 200,
    description: 'Magic link enviado',
    type: MessageResponseDTO,
  })
  async sendMagicLink(@Body() magicLinkDto: MagicLinkDTO): Promise<MessageResponseDTO> {
    return this.authService.sendMagicLink(magicLinkDto);
  }

  @Public()
  @Post('magic-link/login')
  @ApiBody({ type: MagicLinkLoginDTO })
  @ApiOperation({ summary: 'Login via magic link' })
  @ApiResponse({
    status: 200,
    description: 'Login via magic link realizado com sucesso',
    type: AuthResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async loginWithMagicLink(
    @Body() magicLinkLoginDto: MagicLinkLoginDTO,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<TokenPair> {
    const authResponse = await this.authService.loginWithMagicLink(magicLinkLoginDto.token);
    this.authService.setCookieOnly(response, authResponse.access_token, authResponse.refresh_token);
    return authResponse;
  }

  @Public()
  @UseGuards(MagicLinkGuard)
  @Get('magic-link/verify')
  @ApiOperation({ summary: 'Verificar magic link' })
  @ApiResponse({
    status: 200,
    description: 'Magic link verificado com sucesso',
    type: AuthResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async verifyMagicLink(@CurrentUser() userData: CurrentUserData): Promise<TokenPair> {
    return this.authService.loginWithUserId(userData.id);
  }

  @Public()
  @Post('forgot-password')
  @ApiBody({ type: ResetPasswordDTO })
  @ApiOperation({ summary: 'Solicitar reset de senha' })
  @ApiResponse({
    status: 200,
    description: 'Email de recuperação enviado',
    type: MessageResponseDTO,
  })
  async forgotPassword(@Body() resetPasswordDto: ResetPasswordDTO): Promise<MessageResponseDTO> {
    return this.authService.forgotPassword(resetPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @ApiBody({ type: NewPasswordDTO })
  @ApiOperation({ summary: 'Renovar senha' })
  @ApiResponse({
    status: 200,
    description: 'Senha alterada com sucesso',
    type: MessageResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async resetPassword(@Body() newPasswordDto: NewPasswordDTO): Promise<MessageResponseDTO> {
    return this.authService.resetPassword(newPasswordDto);
  }

  @Public()
  @Post('verify-email')
  @ApiBody({ type: VerifyEmailDTO })
  @ApiOperation({ summary: 'Verificar email' })
  @ApiResponse({
    status: 200,
    description: 'Email verificado com sucesso',
    type: MessageResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDTO): Promise<MessageResponseDTO> {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Post('refresh')
  @ApiBody({ type: RefreshTokenDTO })
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados com sucesso',
    type: AuthResponseDTO,
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDTO,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<TokenPair> {
    const authResponse = await this.authService.refreshTokens(refreshTokenDto);
    this.authService.setCookieOnly(response, authResponse.access_token, authResponse.refresh_token);
    return authResponse;
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ type: RefreshTokenDTO })
  @ApiOperation({ summary: 'Fazer logout' })
  async logout(@CurrentUser() user: CurrentUserData): Promise<MessageResponseDTO> {
    return this.authService.logout(user.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter dados do usuário logado' })
  async getProfile(@CurrentUser() user: CurrentUserData): Promise<UserResponseDTO> {
    return this.authService.getProfile(user.id);
  }
}
