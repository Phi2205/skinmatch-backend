import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './services/orders.service.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { VariantsRepository } from '../products/repositories/variants.repository.js';
import { CartsModule } from '../carts/carts.module.js';
import { ProductsModule } from '../products/products.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [
    PrismaModule, 
    CartsModule, 
    ProductsModule,
    forwardRef(() => PaymentsModule),
  ],

  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, VariantsRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
