import { Module } from '@nestjs/common';
import { CategoriesService } from './services/categories.service.js';
import { CategoriesController } from './controllers/categories.controller.js';
import { CategoriesRepository } from './repositories/categories.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
