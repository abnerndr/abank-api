import { BadRequestException } from '@nestjs/common';

export class InvalidReversalTargetException extends BadRequestException {
  constructor() {
    super('Somente depósitos ou transferências concluídos podem ser revertidos');
  }
}
