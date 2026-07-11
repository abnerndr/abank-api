import { BadRequestException } from '@nestjs/common';

export class SelfTransferException extends BadRequestException {
  constructor() {
    super('Não é possível transferir para a própria carteira');
  }
}
