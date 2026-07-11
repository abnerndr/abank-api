import { NotFoundException } from '@nestjs/common';

export class RecipientNotFoundException extends NotFoundException {
  constructor() {
    super('Destinatário não encontrado');
  }
}
