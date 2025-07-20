import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TransactionType,
  TransactionStatus,
  Transaction,
  Prisma,
} from '@prisma/client';
import { UpdateTransactionRequest } from './dto/update-transaction.dto';

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
      nextOccurrence?: Date;
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

    // Se for uma transação recorrente completada, calcular próxima ocorrência
    if (transaction.type === 'RECURRING' && updateData.status === 'COMPLETED') {
      if (transaction.recurrencePattern) {
        const nextOccurrence = this.calculateNextOccurrence(
          new Date(transaction.date),
          transaction.recurrencePattern,
        );
        updatePayload.nextOccurrence = nextOccurrence;
      }
    }

    return await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updatePayload,
    });
  }

  async updateTransaction(
    transactionId: string,
    userId: string,
    updateData: UpdateTransactionRequest,
  ): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    // Preparar dados para atualização
    const updatePayload: Prisma.TransactionUpdateInput = {};

    if (updateData.amountInCents !== undefined) {
      updatePayload.amountInCents = updateData.amountInCents;
    }

    if (updateData.date !== undefined) {
      updatePayload.date = new Date(updateData.date);
    }

    if (updateData.dueDate !== undefined) {
      updatePayload.dueDate = updateData.dueDate
        ? new Date(updateData.dueDate)
        : undefined;
    }

    if (updateData.description !== undefined) {
      updatePayload.description = updateData.description;
    }

    if (updateData.type !== undefined) {
      // Validar se o novo tipo é válido
      const validationData: CreateTransactionServiceData = {
        amountInCents: updateData.amountInCents ?? transaction.amountInCents,
        date: updateData.date ? new Date(updateData.date) : transaction.date,
        dueDate: updateData.dueDate
          ? new Date(updateData.dueDate)
          : (transaction.dueDate ?? undefined),
        description: updateData.description ?? transaction.description,
        type: updateData.type,
        totalInstallments: updateData.totalInstallments,
        recurrencePattern: updateData.recurrencePattern,
        userId,
      };
      this.validateTransactionByType(validationData);
      updatePayload.type = updateData.type;
    }

    if (updateData.status !== undefined) {
      // Validar se o novo status é válido para o tipo
      this.validateStatusUpdate(
        updateData.type || transaction.type,
        updateData.status,
      );
      updatePayload.status = updateData.status;

      // Para transações que foram processadas, definir dateOccurred
      if (this.shouldSetDateOccurred(updateData.status)) {
        updatePayload.dateOccurred = new Date();
      }

      // Se for uma parcela, verificar se todas as parcelas foram pagas
      if (transaction.type === 'INSTALLMENT' && updateData.status === 'PAID') {
        await this.checkInstallmentCompletion(transaction);
      }

      // Se for uma transação recorrente completada, calcular próxima ocorrência
      if (
        transaction.type === 'RECURRING' &&
        updateData.status === 'COMPLETED'
      ) {
        if (transaction.recurrencePattern) {
          const nextOccurrence = this.calculateNextOccurrence(
            new Date(transaction.date),
            transaction.recurrencePattern,
          );
          updatePayload.nextOccurrence = nextOccurrence;
        }
      }
    }

    if (updateData.totalInstallments !== undefined) {
      updatePayload.totalInstallments = updateData.totalInstallments;
    }

    if (updateData.recurrencePattern !== undefined) {
      updatePayload.recurrencePattern = updateData.recurrencePattern;
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

    // Filtrar transações parceladas considerando os filtros de data
    let filteredTransactions = this.filterInstallmentTransactionsByDateRange(
      transactions,
      filters,
    );

    // Se estamos buscando transações recorrentes e há filtros de data, gerar ocorrências virtuais
    const shouldGenerateRecurring =
      filters?.type === 'RECURRING' ||
      (Array.isArray(filters?.type) && filters?.type.includes('RECURRING'));

    if (shouldGenerateRecurring && (filters?.startDate || filters?.endDate)) {
      const recurringTransactions = await this.generateRecurringOccurrences(
        userId,
        filters.startDate,
        filters.endDate,
      );
      filteredTransactions = [
        ...filteredTransactions,
        ...recurringTransactions,
      ];
    }

    return filteredTransactions;
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

  async getTransactionById(
    id: string,
    userId: string,
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
        parentTransaction: true,
      },
    });
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
        if (!['MONTHLY', 'WEEKLY', 'YEARLY'].includes(data.recurrencePattern)) {
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

  private filterInstallmentTransactionsByDateRange(
    transactions: Transaction[],
    filters?: TransactionFilters,
  ): Transaction[] {
    return transactions.filter((transaction) => {
      // Se for uma transação pai de parcelas, não incluir
      if (
        transaction.type === 'INSTALLMENT' &&
        !transaction.parentTransactionId
      ) {
        return false;
      }

      // Se for uma parcela, verificar se está dentro do período filtrado
      if (
        transaction.type === 'INSTALLMENT' &&
        transaction.parentTransactionId
      ) {
        const transactionDate = new Date(transaction.date);

        // Se não há filtros de data, incluir todas as parcelas
        if (!filters?.startDate && !filters?.endDate) {
          return true;
        }

        // Verificar se a data da parcela está dentro do período filtrado
        if (filters?.startDate) {
          const startDate = new Date(filters.startDate);
          if (transactionDate < startDate) {
            return false;
          }
        }

        if (filters?.endDate) {
          const endDate = new Date(filters.endDate);
          if (transactionDate > endDate) {
            return false;
          }
        }

        return true;
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
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'YEARLY':
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

  private async generateRecurringOccurrences(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Transaction[]> {
    // Buscar todas as transações recorrentes ativas do usuário
    const recurringTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'RECURRING',
        status: {
          in: ['PENDING', 'COMPLETED'],
        },
        recurrencePattern: {
          not: null,
        },
      },
    });

    const virtualTransactions: Transaction[] = [];

    for (const recurring of recurringTransactions) {
      if (!recurring.recurrencePattern) continue;

      let currentDate = new Date(recurring.date);
      const endLimit =
        endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 ano no futuro

      // Gerar ocorrências até o limite de data
      while (currentDate <= endLimit) {
        // Se há filtro de data inicial, pular ocorrências antes dessa data
        if (startDate && currentDate < startDate) {
          currentDate = this.calculateNextOccurrence(
            currentDate,
            recurring.recurrencePattern,
          );
          continue;
        }

        // Se há filtro de data final, parar se passou dessa data
        if (endDate && currentDate > endDate) {
          break;
        }

        // Verificar se já existe uma transação real para esta data
        const existingTransaction = await this.prisma.transaction.findFirst({
          where: {
            userId,
            type: 'RECURRING',
            date: currentDate,
            description: recurring.description,
            amountInCents: recurring.amountInCents,
          },
        });

        // Se não existe transação real para esta data, criar virtual
        if (!existingTransaction) {
          // Criar transação virtual
          const virtualTransaction: Transaction = {
            ...recurring,
            id: `${recurring.id}_${currentDate.getTime()}`, // ID único para a ocorrência
            date: currentDate,
            dueDate: recurring.dueDate
              ? this.calculateNextOccurrence(
                  currentDate,
                  recurring.recurrencePattern,
                )
              : null,
            status: 'PENDING' as TransactionStatus,
            dateOccurred: null,
          };

          virtualTransactions.push(virtualTransaction);
        }

        // Calcular próxima ocorrência
        currentDate = this.calculateNextOccurrence(
          currentDate,
          recurring.recurrencePattern,
        );
      }
    }

    return virtualTransactions;
  }
}
