import { ConflictException } from '@nestjs/common';

export class RefundRequestAlreadyResolvedException extends ConflictException {
  constructor() {
    super('Esta solicitação de estorno já foi resolvida');
  }
}
