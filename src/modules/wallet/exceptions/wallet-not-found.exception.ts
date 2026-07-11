import { NotFoundException } from '@nestjs/common';

export class WalletNotFoundException extends NotFoundException {
  constructor() {
    super('Carteira não encontrada');
  }
}
