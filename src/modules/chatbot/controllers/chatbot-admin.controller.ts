import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatbotIngestionService } from '../services/chatbot-ingestion.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { Role } from '../../../generated/prisma/index.js';

@ApiTags('chatbot-admin')
@Controller('chatbot/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class ChatbotAdminController {
  constructor(private readonly ingestionService: ChatbotIngestionService) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Đồng bộ hóa vector hàng loạt cho tất cả sản phẩm đang hoạt động (Admin)' })
  async ingestAll() {
    const stats = await this.ingestionService.ingestAllProducts();
    return {
      success: true,
      message: 'Đồng bộ hóa vector hàng loạt hoàn tất',
      data: stats,
    };
  }

  @Post('ingest/:productId')
  @ApiOperation({ summary: 'Đồng bộ hóa vector cho một sản phẩm cụ thể theo ID (Admin)' })
  async ingestSingle(@Param('productId') productId: string) {
    await this.ingestionService.ingestSingleProduct(Number(productId));
    return {
      success: true,
      message: `Đồng bộ hóa vector sản phẩm ID ${productId} hoàn tất`,
    };
  }
}
