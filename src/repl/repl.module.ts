import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TransactionModule } from '../transaction/transaction.module';
import { ReplService } from './repl.service';

@Module({
  imports: [PrismaModule, AuthModule, TransactionModule],
  providers: [ReplService],
  exports: [ReplService],
})
export class ReplModule {} 