import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { TransferDTO } from './dto/transfer.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('api/wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obter saldo da carteira do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Carteira retornada com sucesso',
    type: WalletResponseDTO,
  })
  async getMyWallet(@CurrentUser() user: CurrentUserData): Promise<WalletResponseDTO> {
    return this.walletService.getWalletBalance(user.id);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Depositar na própria carteira' })
  @ApiBody({ type: DepositDTO })
  @ApiResponse({
    status: 201,
    description: 'Depósito realizado com sucesso',
    type: TransactionResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Valor inválido' })
  async deposit(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: DepositDTO,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.deposit(user.id, dto);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transferir para a carteira de outro usuário' })
  @ApiBody({ type: TransferDTO })
  @ApiResponse({
    status: 201,
    description: 'Transferência realizada com sucesso',
    type: TransactionResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Saldo insuficiente, valor inválido ou auto-transferência' })
  @ApiResponse({ status: 404, description: 'Destinatário não encontrado' })
  async transfer(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: TransferDTO,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.transfer(user.id, dto);
  }
}
