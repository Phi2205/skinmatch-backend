import { Module } from '@nestjs/common';
import { ProductsService } from './services/products.service.js';
import { ProductsController } from './controllers/products.controller.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
