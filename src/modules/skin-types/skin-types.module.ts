import { Module } from '@nestjs/common';
import { SkinTypesService } from './skin-types.service.js';
import { SkinTypesController } from './skin-types.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SkinTypesController],
  providers: [SkinTypesService],
  exports: [SkinTypesService]
})
export class SkinTypesModule {}
