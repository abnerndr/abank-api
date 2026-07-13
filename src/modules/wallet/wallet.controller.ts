import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isAdmin } from '../../shared/utils/auth.utils';
import { ManageTransactions } from '../auth/decorators/check-abilities.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AbilitiesGuard } from '../auth/guards/abilities.guard';
import { DepositDTO } from './dto/deposit.dto';
import { CreateRefundRequestDTO, RefundRequestResponseDTO } from './dto/refund-request.dto';
import { TransactionQueryDTO } from './dto/transaction-query.dto';
import { TransactionListResponseDTO, TransactionResponseDTO } from './dto/transaction-response.dto';
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

  @Get('transactions')
  @ApiOperation({ summary: 'Listar transações da carteira do usuário logado' })
  @ApiResponse({ status: 200, description: 'Lista de transações', type: TransactionListResponseDTO })
  async listTransactions(
    @CurrentUser() user: CurrentUserData,
    @Query() query: TransactionQueryDTO,
  ): Promise<TransactionListResponseDTO> {
    return this.walletService.listTransactions(user.id, query.page, query.limit);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Detalhe de uma transação' })
  @ApiResponse({ status: 200, description: 'Transação encontrada', type: TransactionResponseDTO })
  @ApiResponse({ status: 403, description: 'Sem permissão para ver esta transação' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  async getTransaction(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.getTransaction(user.id, isAdmin(user), id);
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

  @Post('transactions/:id/reverse')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AbilitiesGuard)
  @ManageTransactions()
  @ApiOperation({ summary: 'Reverter uma transação (somente admin)' })
  @ApiResponse({
    status: 200,
    description: 'Transação revertida com sucesso',
    type: TransactionResponseDTO,
  })
  @ApiResponse({ status: 403, description: 'Sem permissão para reverter transações' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  @ApiResponse({ status: 409, description: 'Transação já revertida' })
  async reverse(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.reverse(user.id, id);
  }

  @Post('transactions/:id/refund-request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Solicitar estorno de uma transação' })
  @ApiBody({ type: CreateRefundRequestDTO })
  @ApiResponse({
    status: 201,
    description: 'Solicitação de estorno criada com sucesso',
    type: RefundRequestResponseDTO,
  })
  @ApiResponse({ status: 403, description: 'Sem permissão para solicitar estorno desta transação' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  @ApiResponse({ status: 409, description: 'Já existe solicitação pendente para esta transação' })
  async createRefundRequest(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateRefundRequestDTO,
  ): Promise<RefundRequestResponseDTO> {
    return this.walletService.createRefundRequest(user.id, isAdmin(user), id, dto);
  }
}
