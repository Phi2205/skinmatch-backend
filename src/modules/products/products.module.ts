import { Module } from '@nestjs/common';
import { ProductsService } from './services/products.service.js';
import { ProductsController } from './controllers/products.controller.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { RedisModule } from '../../redis/redis.module.js';
import { ChatbotModule } from '../chatbot/chatbot.module.js';

@Module({
  imports: [PrismaModule, CloudinaryModule, RedisModule, ChatbotModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsModule { }
