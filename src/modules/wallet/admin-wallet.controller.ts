import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReadTransactions } from '../auth/decorators/check-abilities.decorator';
import { AbilitiesGuard } from '../auth/guards/abilities.guard';
import {
  AdminTransactionListResponseDTO,
  AdminUserWalletResponseDTO,
  AdminWalletListResponseDTO,
} from './dto/admin-wallet-response.dto';
import { TransactionQueryDTO } from './dto/transaction-query.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
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
    return this.walletService.listAllWallets(query.page, query.limit);
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
    return this.walletService.listAllTransactions(query.page, query.limit);
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
}
