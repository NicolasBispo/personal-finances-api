import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { TransactionService } from '../transaction/transaction.service';
import * as bcrypt from 'bcryptjs';

// Tipos do Prisma - vamos usar any para evitar problemas de import
type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'RECURRING'
  | 'INSTALLMENT';
type TransactionStatus =
  | 'PENDING'
  | 'PAID'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

@Injectable()
export class ReplService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private transactionService: TransactionService,
  ) {}

  // Expor serviços principais
  get services() {
    return {
      prisma: this.prisma,
      auth: this.authService,
      transaction: this.transactionService,
    };
  }

  // Expor modelos do Prisma
  get models() {
    return {
      TransactionType: {
        INCOME: 'INCOME',
        EXPENSE: 'EXPENSE',
        TRANSFER: 'TRANSFER',
        RECURRING: 'RECURRING',
        INSTALLMENT: 'INSTALLMENT',
      },
      TransactionStatus: {
        PENDING: 'PENDING',
        PAID: 'PAID',
        RECEIVED: 'RECEIVED',
        COMPLETED: 'COMPLETED',
        CANCELLED: 'CANCELLED',
      },
    };
  }

  // Expor utilitários
  get utils() {
    return {
      bcrypt,
      // Helper para converter valor em centavos
      toCents: (value: number) => Math.round(value * 100),
      // Helper para converter centavos em reais
      fromCents: (cents: number) => cents / 100,
      // Helper para criar hash de senha
      hashPassword: (password: string) => bcrypt.hash(password, 10),
      // Helper para comparar senha
      comparePassword: (password: string, hash: string) =>
        bcrypt.compare(password, hash),
    };
  }

  // Métodos de conveniência para operações comuns
  async createUser(name: string, email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async createTransaction(data: {
    amountInCents: number;
    date: Date;
    description: string;
    type: TransactionType;
    status?: TransactionStatus;
    userId: string;
    dateOccurred?: Date;
    installmentNumber?: number;
    totalInstallments?: number;
    parentTransactionId?: string;
    recurrencePattern?: string;
    nextOccurrence?: Date;
  }) {
    return this.prisma.transaction.create({
      data: {
        ...data,
      },
      include: {
        user: { select: { name: true, email: true } },
        parentTransaction: true,
        installments: true,
      },
    });
  }

  async getStats() {
    const userCount = await this.prisma.user.count();
    const transactionCount = await this.prisma.transaction.count();

    return {
      users: userCount,
      transactions: transactionCount,
    };
  }

  // Método para mostrar ajuda
  showHelp() {
    console.log('\n🚀 Personal Finances REPL');
    console.log('=====================================');
    console.log('\n📦 Serviços disponíveis:');
    console.log('  repl.services.prisma     - Prisma Client');
    console.log('  repl.services.auth       - Auth Service');
    console.log('  repl.services.transaction - Transaction Service');
    console.log('\n🏗️  Modelos disponíveis:');
    console.log('  repl.models.TransactionType - Transaction types enum');
    console.log('  repl.models.TransactionStatus - Transaction status enum');
    console.log('\n🔧 Utilitários:');
    console.log('  repl.utils.bcrypt        - bcrypt functions');
    console.log('  repl.utils.toCents()     - Convert R$ to cents');
    console.log('  repl.utils.fromCents()   - Convert cents to R$');
    console.log('  repl.utils.hashPassword() - Hash password');
    console.log('  repl.utils.comparePassword() - Compare password');
    console.log('\n⚡ Métodos de conveniência:');
    console.log('  repl.createUser()        - Create user');
    console.log('  repl.findUserByEmail()   - Find user by email');
    console.log('  repl.createTransaction() - Create transaction');
    console.log('  repl.getStats()          - Get database stats');
    console.log('\n💡 Exemplos:');
    console.log('  // Criar usuário');
    console.log(
      '  await repl.createUser("João", "joao@email.com", "senha123")',
    );
    console.log('\n  // Criar transação');
    console.log('  await repl.createTransaction({');
    console.log('    amountInCents: 15050, // R$ 150,50 em centavos');
    console.log('    date: new Date("2024-01-15"),');
    console.log('    description: "Almoço",');
    console.log('    type: repl.models.TransactionType.EXPENSE,');
    console.log('    status: repl.models.TransactionStatus.PAID,');
    console.log('    userId: "user-id-aqui"');
    console.log('  })');
    console.log('\n  // Buscar usuário');
    console.log('  await repl.services.prisma.user.findMany()');
    console.log('\n  // Estatísticas');
    console.log('  await repl.getStats()');
    console.log('\n=====================================\n');
  }
}
