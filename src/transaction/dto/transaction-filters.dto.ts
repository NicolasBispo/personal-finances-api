import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class TransactionFiltersDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (typeof value === 'string' && value.includes(',')) {
      const result = value.split(',').map((t: string) => t.trim());
      return result;
    }
    return value;
  })
  type?: TransactionType | TransactionType[];

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  startDueDate?: string;

  @IsOptional()
  @IsDateString()
  endDueDate?: string;
}
