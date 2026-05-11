import { Module } from '@nestjs/common';
import { IngredientsService } from './ingredients.service.js';
import { IngredientsController } from './ingredients.controller.js';
import { IngredientsRepository } from './ingredients.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [IngredientsController],
  providers: [IngredientsService, IngredientsRepository],
  exports: [IngredientsService, IngredientsRepository],
})
export class IngredientsModule {}
