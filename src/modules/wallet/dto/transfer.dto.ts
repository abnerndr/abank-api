import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPositiveDecimalString } from '../../../shared/validators/is-positive-decimal-string.validator';

export class TransferDTO {
  @ApiProperty({ description: 'Email do destinatário', example: 'destinatario@example.com' })
  @IsEmail({}, { message: 'Email do destinatário deve ter um formato válido' })
  toEmail: string;

  @ApiProperty({ description: 'Valor a transferir', example: '50.00' })
  @IsPositiveDecimalString()
  amount: string;

  @ApiPropertyOptional({
    description:
      'Chave de idempotência — reenviar a mesma chave retorna a transação já processada em vez de reprocessar',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
