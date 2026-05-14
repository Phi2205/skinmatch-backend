import { Module } from '@nestjs/common';
import { ProductsService } from './services/products.service.js';
import { ReviewsService } from './services/reviews.service.js';
import { ProductsController } from './controllers/products.controller.js';
import { ReviewsController } from './controllers/reviews.controller.js';
import { BannersController } from './controllers/banners.controller.js';
import { ProductsRepository } from './repositories/products.repository.js';
import { ReviewsRepository } from './repositories/reviews.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { RedisModule } from '../../redis/redis.module.js';
import { ChatbotModule } from '../chatbot/chatbot.module.js';

@Module({
  imports: [PrismaModule, CloudinaryModule, RedisModule, ChatbotModule],
  controllers: [ProductsController, ReviewsController, BannersController],
  providers: [ProductsService, ProductsRepository, ReviewsService, ReviewsRepository],
  exports: [ProductsService, ProductsRepository, ReviewsService, ReviewsRepository],
})
export class ProductsModule { }
