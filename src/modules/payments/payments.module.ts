import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './services/payments.service.js';
import { PaymentsController } from './controllers/payments.controller.js';
import { PaymentsRepository } from './repositories/payments.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OrdersService } from '../orders/services/orders.service.js';

@Module({
  imports: [PrismaModule, forwardRef(() => OrdersModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}
