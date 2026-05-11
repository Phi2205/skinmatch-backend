import { Module } from '@nestjs/common';
import { CacheController } from './cache.controller.js';
import { RedisModule } from '../../redis/redis.module.js';

@Module({
  imports: [RedisModule],
  controllers: [CacheController],
})
export class CacheModule {}
