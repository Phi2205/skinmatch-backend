import { Module } from '@nestjs/common';
import { BadgesService } from './badges.service.js';
import { BadgesController } from './badges.controller.js';
import { BadgesRepository } from './badges.repository.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [BadgesController],
  providers: [BadgesService, BadgesRepository],
  exports: [BadgesService, BadgesRepository],
})
export class BadgesModule {}
