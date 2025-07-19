import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TransactionType,
  TransactionStatus,
  Transaction,
  Prisma,
} from '@prisma/client';

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

export interface UpdateTransactionStatusDto {
  status: TransactionStatus;
  dateOccurred?: Date;
}

interface TransactionFilters {
  type?: TransactionType | TransactionType[];
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  startDueDate?: Date;
  endDueDate?: Date;
}

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async createTransaction(
    data: CreateTransactionServiceData,
  ): Promise<Transaction> {
    // Validações específicas por tipo
    this.validateTransactionByType(data);

    if (data.type === 'INSTALLMENT' && data.totalInstallments) {
      return await this.createInstallmentTransaction(data);
    }

    if (data.type === 'RECURRING' && data.recurrencePattern) {
      return await this.createRecurringTransaction(data);
    }

    // Transação simples
    console.log('data.type', data.type);
    return await this.prisma.transaction.create({
      data: {
        amountInCents: data.amountInCents,
        date: new Date(data.date),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        description: data.description,
        type: data.type,
        status: this.getDefaultStatusForType(data.type),
        userId: data.userId,
      },
    });
  }

  async updateTransactionStatus(
    transactionId: string,
    userId: string,
    updateData: UpdateTransactionStatusDto,
  ): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Validações específicas por tipo
    this.validateStatusUpdate(transaction.type, updateData.status);

    const updatePayload: {
      status: TransactionStatus;
      dateOccurred?: Date;
    } = {
      status: updateData.status,
    };

    // Para transações que foram processadas, definir dateOccurred
    if (this.shouldSetDateOccurred(updateData.status)) {
      updatePayload.dateOccurred = updateData.dateOccurred || new Date();
    }

    // Se for uma parcela, verificar se todas as parcelas foram pagas
    if (transaction.type === 'INSTALLMENT' && updateData.status === 'PAID') {
      await this.checkInstallmentCompletion(transaction);
    }

    return await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updatePayload,
    });
  }

  async getTransactionsByUser(
    userId: string,
    filters?: TransactionFilters,
  ): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = { userId };

    if (filters?.type) {
      if (Array.isArray(filters.type)) {
        where.type = { in: filters.type };
      } else {
        where.type = filters.type;
      }
    }
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters?.startDueDate || filters?.endDueDate) {
      where.dueDate = {};
      if (filters.startDueDate) where.dueDate.gte = filters.startDueDate;
      if (filters.endDueDate) where.dueDate.lte = filters.endDueDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        installments: true,
        parentTransaction: true,
      },
      orderBy: { date: 'desc' },
    });

    // Filtrar transações parceladas para mostrar apenas as parcelas do mês atual
    return this.filterInstallmentTransactionsByCurrentMonth(transactions);
  }

  async getOverdueTransactions(userId: string): Promise<Transaction[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        dueDate: {
          lt: today,
        },
        status: {
          in: ['PENDING'],
        },
        type: {
          in: ['EXPENSE', 'INSTALLMENT'],
        },
      },
      include: {
        installments: true,
        parentTransaction: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Filtrar transações parceladas para mostrar apenas as parcelas
    return this.filterInstallmentTransactions(transactions);
  }

  async getUpcomingDueTransactions(
    userId: string,
    daysAhead: number = 7,
  ): Promise<Transaction[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    futureDate.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        dueDate: {
          gte: today,
          lte: futureDate,
        },
        status: {
          in: ['PENDING'],
        },
        type: {
          in: ['EXPENSE', 'INSTALLMENT'],
        },
      },
      include: {
        installments: true,
        parentTransaction: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Filtrar transações parceladas para mostrar apenas as parcelas
    return this.filterInstallmentTransactions(transactions);
  }

  private validateTransactionByType(data: CreateTransactionServiceData): void {
    switch (data.type) {
      case 'INCOME':
        // Receitas não podem ter parcelas
        if (data.totalInstallments) {
          throw new BadRequestException(
            'Income transactions cannot have installments',
          );
        }
        break;

      case 'EXPENSE':
        // Despesas podem ter parcelas, mas não são obrigatórias
        break;

      case 'INSTALLMENT':
        if (!data.totalInstallments || data.totalInstallments < 2) {
          throw new BadRequestException(
            'Installment transactions must have at least 2 installments',
          );
        }
        if (data.amountInCents <= 0) {
          throw new BadRequestException(
            'Installment amount must be greater than 0',
          );
        }
        break;

      case 'RECURRING':
        if (!data.recurrencePattern) {
          throw new BadRequestException(
            'Recurring transactions must have a recurrence pattern',
          );
        }
        if (!['monthly', 'weekly', 'yearly'].includes(data.recurrencePattern)) {
          throw new BadRequestException('Invalid recurrence pattern');
        }
        break;

      case 'TRANSFER':
        // Transferências são instantâneas
        break;
    }
  }

  private validateStatusUpdate(
    type: TransactionType,
    status: TransactionStatus,
  ): void {
    const validStatuses = this.getValidStatusesForType(type);

    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Status '${status}' is not valid for transaction type '${type}'. Valid statuses: ${validStatuses.join(', ')}`,
      );
    }
  }

  private getValidStatusesForType(type: TransactionType): TransactionStatus[] {
    switch (type) {
      case 'INCOME':
        return ['PENDING', 'RECEIVED', 'CANCELLED'];
      case 'EXPENSE':
        return ['PENDING', 'PAID', 'CANCELLED'];
      case 'INSTALLMENT':
        return ['PENDING', 'PAID', 'CANCELLED'];
      case 'RECURRING':
        return ['PENDING', 'COMPLETED', 'CANCELLED'];
      case 'TRANSFER':
        return ['PENDING', 'COMPLETED', 'CANCELLED'];
      default:
        return ['PENDING', 'CANCELLED'];
    }
  }

  private getDefaultStatusForType(type: TransactionType): TransactionStatus {
    switch (type) {
      case 'TRANSFER':
        return 'COMPLETED'; // Transferências são instantâneas
      default:
        return 'PENDING';
    }
  }

  private shouldSetDateOccurred(status: TransactionStatus): boolean {
    return ['PAID', 'RECEIVED', 'COMPLETED'].includes(status);
  }

  private filterInstallmentTransactions(
    transactions: Transaction[],
  ): Transaction[] {
    return transactions.filter((transaction) => {
      // Se for uma transação pai de parcelas, não incluir
      if (
        transaction.type === 'INSTALLMENT' &&
        !transaction.parentTransactionId
      ) {
        return false;
      }

      // Para outros tipos de transação, incluir normalmente
      return true;
    });
  }

  private filterInstallmentTransactionsByCurrentMonth(
    transactions: Transaction[],
  ): Transaction[] {
    return transactions.filter((transaction) => {
      // Se for uma transação pai de parcelas, não incluir
      if (
        transaction.type === 'INSTALLMENT' &&
        !transaction.parentTransactionId
      ) {
        return false;
      }

      // Se for uma parcela, verificar se é do mês atual
      if (
        transaction.type === 'INSTALLMENT' &&
        transaction.parentTransactionId
      ) {
        const currentDate = new Date();
        const transactionDate = new Date(transaction.date);

        return (
          transactionDate.getMonth() === currentDate.getMonth() &&
          transactionDate.getFullYear() === currentDate.getFullYear()
        );
      }

      // Para outros tipos de transação, incluir normalmente
      return true;
    });
  }

  private async createInstallmentTransaction(
    data: CreateTransactionServiceData,
  ): Promise<Transaction> {
    const installments: Array<{
      amountInCents: number;
      date: Date;
      dueDate: Date;
      description: string;
      type: TransactionType;
      status: TransactionStatus;
      userId: string;
      installmentNumber: number;
      totalInstallments: number;
      parentTransactionId: string;
    }> = [];

    // Calcular valor total da transação (valor da parcela * número de parcelas)
    const totalAmount = data.amountInCents * data.totalInstallments!;

    // Criar transação pai com o valor total
    const parentTransaction = await this.prisma.transaction.create({
      data: {
        amountInCents: totalAmount,
        date: new Date(data.date),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        description: data.description,
        type: 'INSTALLMENT',
        status: 'PENDING',
        userId: data.userId,
        totalInstallments: data.totalInstallments,
      },
    });

    // Criar parcelas - todas com o mesmo valor da parcela
    for (let i = 1; i <= data.totalInstallments!; i++) {
      const installmentDate = new Date(new Date(data.date));
      installmentDate.setMonth(installmentDate.getMonth() + i - 1);

      // Calcular data de vencimento da parcela
      const installmentDueDate = data.dueDate
        ? new Date(
            new Date(data.dueDate).getTime() +
              (i - 1) * 30 * 24 * 60 * 60 * 1000,
          ) // +30 dias por parcela
        : installmentDate;

      installments.push({
        amountInCents: data.amountInCents, // Todas as parcelas têm o mesmo valor
        date: installmentDate,
        dueDate: installmentDueDate,
        description: `${data.description} - Parcela ${i}/${data.totalInstallments}`,
        type: 'INSTALLMENT',
        status: 'PENDING',
        userId: data.userId,
        installmentNumber: i,
        totalInstallments: data.totalInstallments!,
        parentTransactionId: parentTransaction.id,
      });
    }

    await this.prisma.transaction.createMany({
      data: installments,
    });

    return parentTransaction;
  }

  private async createRecurringTransaction(
    data: CreateTransactionServiceData,
  ): Promise<Transaction> {
    const nextOccurrence = this.calculateNextOccurrence(
      new Date(data.date),
      data.recurrencePattern!,
    );

    return await this.prisma.transaction.create({
      data: {
        amountInCents: data.amountInCents,
        date: new Date(data.date),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        description: data.description,
        type: 'RECURRING',
        status: 'PENDING',
        userId: data.userId,
        recurrencePattern: data.recurrencePattern,
        nextOccurrence,
      },
    });
  }

  private calculateNextOccurrence(date: Date, pattern: string): Date {
    const next = new Date(date);

    switch (pattern) {
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  private async checkInstallmentCompletion(
    transaction: Transaction,
  ): Promise<void> {
    if (!transaction.parentTransactionId) return;

    const allInstallments = await this.prisma.transaction.findMany({
      where: { parentTransactionId: transaction.parentTransactionId },
    });

    const allPaid = allInstallments.every((inst) => inst.status === 'PAID');

    if (allPaid) {
      await this.prisma.transaction.update({
        where: { id: transaction.parentTransactionId },
        data: { status: 'PAID' },
      });
    }
  }
}
