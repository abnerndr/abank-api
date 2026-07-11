import { ConflictException } from '@nestjs/common';

export class TransactionAlreadyReversedException extends ConflictException {
  constructor() {
    super('Transação já foi revertida');
  }
}
