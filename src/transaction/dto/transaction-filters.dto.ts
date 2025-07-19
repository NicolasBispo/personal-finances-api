import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class TransactionFiltersDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    console.log('value inicial', value);
    if (typeof value === 'string' && value.includes(',')) {
      console.log('value dentro do if', value);
      const result = value.split(',').map((t: string) => t.trim());
      console.log('result', result);
      return result;
    }
    console.log('value fora do if', value);
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
