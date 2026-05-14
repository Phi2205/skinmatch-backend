import { Controller, Post, Param, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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

  @Post('clear')
  @ApiOperation({ summary: 'Xóa toàn bộ dữ liệu vector embeddings với mật khẩu xác nhận (Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        password: {
          type: 'string',
          example: 'abcd',
          description: 'Mật khẩu xác nhận để xóa toàn bộ dữ liệu',
        },
      },
      required: ['password'],
    },
  })
  async clearAllEmbeddings(@Body('password') password: string) {
    if (password !== '123456') {
      throw new UnauthorizedException('Mật khẩu xác nhận không chính xác');
    }
    const result = await this.ingestionService.clearAllEmbeddings();
    return {
      success: true,
      message: 'Đã dọn dẹp toàn bộ dữ liệu vector embeddings',
      data: result,
    };
  }
}
