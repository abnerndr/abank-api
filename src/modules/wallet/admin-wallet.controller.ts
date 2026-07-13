import {
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefundRequestStatus } from '../../shared/enums/wallet.enum';
import { ManageTransactions, ReadTransactions } from '../auth/decorators/check-abilities.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AbilitiesGuard } from '../auth/guards/abilities.guard';
import {
  AdminTransactionListResponseDTO,
  AdminUserWalletResponseDTO,
  AdminWalletListResponseDTO,
} from './dto/admin-wallet-response.dto';
import { TransactionQueryDTO } from './dto/transaction-query.dto';
import {
  RefundRequestListResponseDTO,
  RefundRequestQueryDTO,
  RefundRequestResponseDTO,
} from './dto/refund-request.dto';
import {
  AdminTransactionStatsResponseDTO,
  TransactionResponseDTO,
} from './dto/transaction-response.dto';
import { WalletService } from './wallet.service';

@ApiTags('Admin — Wallet')
@ApiBearerAuth()
@Controller('api/admin/wallet')
@UseGuards(AbilitiesGuard)
export class AdminWalletController {
  constructor(private walletService: WalletService) {}

  @Get('wallets')
  @ReadTransactions()
  @ApiOperation({ summary: 'Listar todas as carteiras (backoffice)' })
  @ApiResponse({ status: 200, description: 'Lista de carteiras', type: AdminWalletListResponseDTO })
  async listWallets(@Query() query: TransactionQueryDTO): Promise<AdminWalletListResponseDTO> {
    return this.walletService.listAllWallets(
      query.page,
      query.limit,
      query.excludeUserEmailPrefix,
    );
  }

  @Get('users/:userId')
  @ReadTransactions()
  @ApiOperation({ summary: 'Obter carteira de um usuário por ID (backoffice)' })
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiResponse({ status: 200, description: 'Carteira do usuário', type: AdminUserWalletResponseDTO })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async getUserWallet(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<AdminUserWalletResponseDTO> {
    return this.walletService.getWalletByUserId(userId);
  }

  @Get('transactions')
  @ReadTransactions()
  @ApiOperation({ summary: 'Listar todas as transações (backoffice)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transações',
    type: AdminTransactionListResponseDTO,
  })
  async listTransactions(
    @Query() query: TransactionQueryDTO,
  ): Promise<AdminTransactionListResponseDTO> {
    return this.walletService.listAllTransactions(
      query.page,
      query.limit,
      query.excludeUserEmailPrefix,
    );
  }

  @Get('transactions/stats')
  @ReadTransactions()
  @ApiOperation({ summary: 'Estatísticas de transações para o backoffice' })
  @ApiResponse({
    status: 200,
    description: 'Totais de transações e solicitações de estorno pendentes',
    type: AdminTransactionStatsResponseDTO,
  })
  async getTransactionStats(
    @Query() query: TransactionQueryDTO,
  ): Promise<AdminTransactionStatsResponseDTO> {
    return this.walletService.getTransactionStats(query.excludeUserEmailPrefix);
  }

  @Get('transactions/:id')
  @ReadTransactions()
  @ApiOperation({ summary: 'Detalhe de qualquer transação (backoffice)' })
  @ApiParam({ name: 'id', description: 'ID da transação' })
  @ApiResponse({ status: 200, description: 'Transação encontrada', type: TransactionResponseDTO })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  async getTransaction(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.getTransactionForAdmin(id);
  }

  @Get('refund-requests')
  @ReadTransactions()
  @ApiOperation({ summary: 'Listar solicitações de estorno (backoffice)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de solicitações de estorno',
    type: RefundRequestListResponseDTO,
  })
  async listRefundRequests(
    @Query() query: RefundRequestQueryDTO,
  ): Promise<RefundRequestListResponseDTO> {
    return this.walletService.listRefundRequests(
      query.page,
      query.limit,
      query.status ?? RefundRequestStatus.PENDING,
      query.excludeUserEmailPrefix,
    );
  }

  @Post('refund-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ManageTransactions()
  @ApiOperation({ summary: 'Aprovar solicitação de estorno e reverter transação' })
  @ApiParam({ name: 'id', description: 'ID da solicitação de estorno' })
  @ApiResponse({
    status: 200,
    description: 'Solicitação aprovada e transação revertida',
    type: RefundRequestResponseDTO,
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  @ApiResponse({ status: 409, description: 'Solicitação já resolvida ou transação já revertida' })
  async approveRefundRequest(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RefundRequestResponseDTO> {
    return this.walletService.approveRefundRequest(user.id, id);
  }

  @Post('refund-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ManageTransactions()
  @ApiOperation({ summary: 'Rejeitar solicitação de estorno' })
  @ApiParam({ name: 'id', description: 'ID da solicitação de estorno' })
  @ApiResponse({
    status: 200,
    description: 'Solicitação rejeitada',
    type: RefundRequestResponseDTO,
  })
  @ApiResponse({ status: 404, description: 'Solicitação não encontrada' })
  @ApiResponse({ status: 409, description: 'Solicitação já resolvida' })
  async rejectRefundRequest(
    @CurrentUser() user: CurrentUserData,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RefundRequestResponseDTO> {
    return this.walletService.rejectRefundRequest(user.id, id);
  }
}
