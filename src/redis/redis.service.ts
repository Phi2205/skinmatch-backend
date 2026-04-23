import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    if (redisUrl) {
      this.client = new Redis(redisUrl.replace(/["']/g, '').trim());
    } else {
      this.client = new Redis({
        host: this.configService.get<string>('REDIS_HOST') || 'localhost',
        port: this.configService.get<number>('REDIS_PORT') || 6379,
        ...(redisPassword &&
          redisPassword.trim() !== '' && { password: redisPassword }),
        db: this.configService.get<number>('REDIS_DB') || 0,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });
    }

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Connected:', redisUrl ? 'via REDIS_URL' : 'Local');
    });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      console.log('Redis connection established');
    } catch (err) {
      console.warn('Redis connection failed on startup:', err.message ?? err);
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
}
