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
import { TransactionType } from '@prisma/client';

// Interface para o request HTTP (com strings para datas)
export interface CreateTransactionRequest {
  amountInCents: number;
  date: string;
  dueDate?: string;
  description: string;
  type: TransactionType;
  totalInstallments?: number;
  recurrencePattern?: string;
}

// Interface para o service (com Dates)
export interface CreateTransactionServiceData {
  amountInCents: number;
  date: Date;
  dueDate?: Date;
  description: string;
  type: TransactionType;
  totalInstallments?: number;
  recurrencePattern?: string;
  userId: string;
}

export class CreateTransactionDto {
  @IsNumber()
  @Min(1, { message: 'O valor deve ser maior que 0' })
  amountInCents: number; // Valor da parcela para transações parceladas, valor total para outras

  @IsDateString({}, { message: 'Data deve estar no formato ISO (YYYY-MM-DD)' })
  date: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de vencimento deve estar no formato ISO (YYYY-MM-DD)' },
  )
  dueDate?: string;

  @IsString()
  description: string;

  @IsEnum(TransactionType, { message: 'Tipo de transação inválido' })
  type: TransactionType;

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
