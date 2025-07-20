import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import {
  TransactionService,
  UpdateTransactionStatusDto,
} from './transaction.service';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthResponseDto } from '../auth/dto';
import { TransactionFiltersDto, CreateTransactionRequest } from './dto';
import { UpdateTransactionDto } from './dto';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  async createTransaction(
    @Body() data: CreateTransactionRequest,
    @CurrentUser() user: AuthResponseDto,
  ) {
    return this.transactionService.createTransaction({
      amountInCents: data.amountInCents,
      date: new Date(data.date),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      description: data.description,
      type: data.type,
      totalInstallments: data.totalInstallments,
      recurrencePattern: data.recurrencePattern,
      userId: user.id,
    });
  }

  @Put(':id/status')
  async updateTransactionStatus(
    @Param('id') id: string,
    @Body() updateData: UpdateTransactionStatusDto,
    @CurrentUser() user: AuthResponseDto,
  ) {
    return this.transactionService.updateTransactionStatus(
      id,
      user.id,
      updateData,
    );
  }

  @Put(':id')
  async replaceTransaction(
    @Param('id') id: string,
    @Body() updateData: UpdateTransactionDto,
    @CurrentUser() user: AuthResponseDto,
  ) {
    return this.transactionService.updateTransaction(id, user.id, updateData);
  }

  @Patch(':id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateData: UpdateTransactionDto,
    @CurrentUser() user: AuthResponseDto,
  ) {
    return this.transactionService.updateTransaction(id, user.id, updateData);
  }

  @Get()
  async getTransactions(
    @CurrentUser() user: AuthResponseDto,
    @Query() filters: TransactionFiltersDto,
  ) {
    const processedFilters: {
      type?: TransactionType | TransactionType[];
      status?: TransactionStatus;
      startDate?: Date;
      endDate?: Date;
      startDueDate?: Date;
      endDueDate?: Date;
    } = {};

    if (filters.type) processedFilters.type = filters.type;
    if (filters.status) processedFilters.status = filters.status;
    if (filters.startDate)
      processedFilters.startDate = new Date(filters.startDate);
    if (filters.endDate) processedFilters.endDate = new Date(filters.endDate);
    if (filters.startDueDate)
      processedFilters.startDueDate = new Date(filters.startDueDate);
    if (filters.endDueDate)
      processedFilters.endDueDate = new Date(filters.endDueDate);

    return this.transactionService.getTransactionsByUser(
      user.id,
      processedFilters,
    );
  }

  @Get('overdue')
  async getOverdueTransactions(@CurrentUser() user: AuthResponseDto) {
    return this.transactionService.getOverdueTransactions(user.id);
  }

  @Get('upcoming-due')
  async getUpcomingDueTransactions(
    @CurrentUser() user: AuthResponseDto,
    @Query('daysAhead') daysAhead?: string,
  ) {
    const days = daysAhead ? parseInt(daysAhead, 10) : 7;
    return this.transactionService.getUpcomingDueTransactions(user.id, days);
  }

  @Get('summary')
  async getTransactionSummary(
    @CurrentUser() user: AuthResponseDto,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: {
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const transactions = await this.transactionService.getTransactionsByUser(
      user.id,
      filters,
    );

    const summary = {
      totalIncome: 0,
      totalExpenses: 0,
      pendingExpenses: 0,
      pendingIncome: 0,
      balance: 0,
      byType: {
        INCOME: { count: 0, amount: 0 },
        EXPENSE: { count: 0, amount: 0 },
        INSTALLMENT: { count: 0, amount: 0 },
        RECURRING: { count: 0, amount: 0 },
        TRANSFER: { count: 0, amount: 0 },
      },
      byStatus: {
        PENDING: { count: 0, amount: 0 },
        PAID: { count: 0, amount: 0 },
        RECEIVED: { count: 0, amount: 0 },
        COMPLETED: { count: 0, amount: 0 },
        CANCELLED: { count: 0, amount: 0 },
      },
    };

    transactions.forEach((transaction) => {
      const amountInCents = transaction.amountInCents;

      // Contagem por tipo
      summary.byType[transaction.type].count++;
      summary.byType[transaction.type].amount += amountInCents;

      // Contagem por status
      summary.byStatus[transaction.status].count++;
      summary.byStatus[transaction.status].amount += amountInCents;

      // Totais específicos
      if (transaction.type === 'INCOME') {
        summary.totalIncome += amountInCents;
        if (transaction.status === 'PENDING') {
          summary.pendingIncome += amountInCents;
        }
      } else if (['EXPENSE', 'INSTALLMENT'].includes(transaction.type)) {
        summary.totalExpenses += amountInCents;
        if (transaction.status === 'PENDING') {
          summary.pendingExpenses += amountInCents;
        }
      }
    });

    summary.balance = summary.totalIncome - summary.totalExpenses;

    return summary;
  }

  @Get(':id')
  async getTransactionById(
    @Param('id') id: string,
    @CurrentUser() user: AuthResponseDto,
  ) {
    const transaction = await this.transactionService.getTransactionById(
      id,
      user.id,
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }
}
