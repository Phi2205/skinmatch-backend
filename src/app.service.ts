import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './modules/prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
      return {
        status: 'OK',
        database: 'Connected',
        redis: 'Connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: error.message || error,
        timestamp: new Date().toISOString(),
      };
    }
  }

  onApplicationBootstrap() {
    // Chạy kiểm tra health check đầu tiên ngay sau khi ứng dụng khởi động thành công
    this.runHealthCheck();

    // Thiết lập chu kỳ 30 giây chạy check health một lần
    setInterval(() => {
      this.runHealthCheck();
    }, 30000);
  }

  private async runHealthCheck() {
    const timestamp = new Date().toLocaleString('vi-VN');
    try {
      // 1. Kiểm tra kết nối database Postgres bằng truy vấn siêu nhẹ SELECT 1
      await this.prisma.$queryRaw`SELECT 1`;

      // 2. Kiểm tra kết nối Redis Cache bằng lệnh ping()
      const redisPingResult = await this.redis.ping();

      console.log(`[HEALTH CHECK] [${timestamp}] - STATUS: OK | DB: Connected | Redis: ${redisPingResult}`);
    } catch (error) {
      console.error(`[HEALTH CHECK] [${timestamp}] - STATUS: ERROR | Details:`, error.message || error);
    }
  }
}

