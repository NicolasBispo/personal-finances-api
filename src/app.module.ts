import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransactionModule } from './transaction/transaction.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReplModule } from './repl/repl.module';
import { InstallmentModule } from './installment/installment.module';

@Module({
  imports: [PrismaModule, TransactionModule, AuthModule, ReplModule, InstallmentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
