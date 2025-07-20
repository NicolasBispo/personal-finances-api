import {
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
  IsInt,
  IsIn,
} from 'class-validator';
import { TransactionType, TransactionStatus } from '@prisma/client';

// Interface para o request HTTP (com strings para datas)
export interface UpdateTransactionRequest {
  amountInCents?: number;
  date?: string;
  dueDate?: string;
  description?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  totalInstallments?: number;
  recurrencePattern?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'O valor deve ser maior que 0' })
  amountInCents?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data deve estar no formato ISO (YYYY-MM-DD)' })
  date?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de vencimento deve estar no formato ISO (YYYY-MM-DD)' },
  )
  dueDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TransactionType, { message: 'Tipo de transação inválido' })
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus, { message: 'Status de transação inválido' })
  status?: TransactionStatus;

  @IsOptional()
  @IsInt()
  @Min(2, { message: 'Número de parcelas deve ser pelo menos 2' })
  totalInstallments?: number;

  @IsOptional()
  @IsString()
  @IsIn(['monthly', 'weekly', 'yearly'], {
    message: 'Padrão de recorrência deve ser: monthly, weekly ou yearly',
  })
  recurrencePattern?: string;
} 