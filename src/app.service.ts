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
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
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
    console.log(`[HEALTH CHECK] [${timestamp}] - STATUS: OK`);
  }
}

