import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Transaction } from '@prisma/client';

@Injectable()
export class InstallmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getInstallmentById(
    id: string,
    userId: string,
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id,
        userId,
        type: 'INSTALLMENT',
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

  async getInstallmentChildren(
    parentId: string,
    userId: string,
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        parentTransactionId: parentId,
        userId,
        type: 'INSTALLMENT',
      },
      orderBy: {
        installmentNumber: 'asc',
      },
    });
  }
} 