import { ConflictException } from '@nestjs/common';

export class RefundRequestAlreadyPendingException extends ConflictException {
  constructor() {
    super('Já existe uma solicitação de estorno pendente para esta transação');
  }
}
