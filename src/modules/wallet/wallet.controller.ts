import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
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
}
