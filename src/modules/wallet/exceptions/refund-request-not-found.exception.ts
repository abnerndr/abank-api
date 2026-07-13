import { NotFoundException } from '@nestjs/common';

export class RefundRequestNotFoundException extends NotFoundException {
  constructor() {
    super('Solicitação de estorno não encontrada');
  }
}
