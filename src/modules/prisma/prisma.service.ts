import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.warn(
        'Prisma client failed to connect on startup:',
        err.message ?? err,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
