import { Module } from '@nestjs/common';
import { CartsService } from './services/carts.service.js';
import { CartsController } from './controllers/carts.controller.js';
import { CartsRepository } from './repositories/carts.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CartsController],
  providers: [CartsService, CartsRepository],
  exports: [CartsService],
})
export class CartsModule { }
