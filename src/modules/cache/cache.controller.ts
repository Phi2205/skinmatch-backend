import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RedisService } from '../../redis/redis.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/index.js';

@ApiTags('maintenance')
@Controller('cache')
export class CacheController {
  constructor(private readonly redisService: RedisService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all cache (Admin only)' })
  async clearCache() {
    await this.redisService.flushDb();
    return {
      success: true,
      message: 'All cache cleared successfully',
    };
  }
}
