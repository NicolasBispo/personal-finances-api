import {
  Controller,
  Get,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthResponseDto } from '../auth/dto';
import { InstallmentService } from './installment.service';

@Controller('installments')
@UseGuards(JwtAuthGuard)
export class InstallmentController {
  constructor(private readonly installmentService: InstallmentService) {}

  @Get(':id')
  async getInstallmentById(
    @Param('id') id: string,
    @CurrentUser() user: AuthResponseDto,
  ) {
    const installment = await this.installmentService.getInstallmentById(
      id,
      user.id,
    );

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    // Verificar se é uma installment principal (não tem parentTransactionId)
    if (installment.parentTransactionId) {
      throw new BadRequestException(
        'This is not a principal installment. Only principal installments can be accessed by this endpoint.',
      );
    }

    return installment;
  }

  @Get(':id/installments')
  async getInstallmentChildren(
    @Param('id') id: string,
    @CurrentUser() user: AuthResponseDto,
  ) {
    const installment = await this.installmentService.getInstallmentById(
      id,
      user.id,
    );

    if (!installment) {
      throw new NotFoundException('Installment not found');
    }

    // Verificar se é uma installment principal (não tem parentTransactionId)
    if (installment.parentTransactionId) {
      throw new BadRequestException(
        'This is not a principal installment. Only principal installments can have child installments.',
      );
    }

    return this.installmentService.getInstallmentChildren(id, user.id);
  }
}
