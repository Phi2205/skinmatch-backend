import { Module } from '@nestjs/common';
import { ConcernsService } from './concerns.service.js';
import { ConcernsController } from './concerns.controller.js';
import { ConcernsRepository } from './concerns.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ConcernsController],
  providers: [ConcernsService, ConcernsRepository],
  exports: [ConcernsService, ConcernsRepository],
})
export class ConcernsModule { }
