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
    // Chạy kiểm tra health check đầu tiên sau 5 giây để đảm bảo cổng đã mở và server đã lắng nghe
    setTimeout(() => {
      this.runHealthCheck();
    }, 5000);

    // Thiết lập chu kỳ 30 giây chạy check health một lần
    setInterval(() => {
      this.runHealthCheck();
    }, 30000);
  }

  private async runHealthCheck() {
    const timestamp = new Date().toLocaleString('vi-VN');
    const port = process.env.PORT ?? 4000;
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    const url = `${baseUrl}/health`;

    try {
      const response = await fetch(url);
      const data = await response.json() as any;
      console.log(`[HEALTH CHECK] [${timestamp}] - Self-ping successful! URL: ${url} - STATUS: ${response.status} - RESPONSE:`, data);
    } catch (error: any) {
      console.error(`[HEALTH CHECK] [${timestamp}] - Self-ping failed! URL: ${url} - Error:`, error.message);
    }
  }
}

