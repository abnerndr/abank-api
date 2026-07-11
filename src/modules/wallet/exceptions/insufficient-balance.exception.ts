import { BadRequestException } from '@nestjs/common';

export class InsufficientBalanceException extends BadRequestException {
  constructor() {
    super('Saldo insuficiente para realizar a operação');
  }
}
