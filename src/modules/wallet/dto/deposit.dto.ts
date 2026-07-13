import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsPositiveDecimalString } from '../../../shared/validators/is-positive-decimal-string.validator';

export class DepositDTO {
  @ApiProperty({ description: 'Valor a depositar', example: '150.00' })
  @IsPositiveDecimalString()
  amount: string;

  @ApiProperty({
    description:
      'Chave de idempotência — reenviar a mesma chave retorna a transação já processada em vez de reprocessar',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  idempotencyKey: string;
}
