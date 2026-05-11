import { Controller, Post, Body, Res, Get, Param, UseGuards, Req, ForbiddenException, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ChatbotService } from '../services/chatbot.service.js';
import { AskChatbotDto } from '../dto/ask-chatbot.dto.js';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard.js';
import * as express from 'express';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * Kiểm tra quyền truy cập phiên chat:
   * - Nếu đã đăng nhập: sessionId bắt buộc phải bắt đầu bằng "user-[userId]"
   * - Nếu là khách vãng lai: tuyệt đối không được dùng sessionId của thành viên (bắt đầu bằng "user-")
   */
  private validateSessionAccess(sessionId: string, user: any) {
    if (user) {
      if (!sessionId.startsWith(`user-${user.id}`)) {
        throw new ForbiddenException('Bạn không có quyền sử dụng phiên trò chuyện này');
      }
    } else {
      if (sessionId.startsWith('user-')) {
        throw new ForbiddenException('Khách vãng lai không được phép sử dụng phiên trò chuyện của thành viên');
      }
    }
  }

  @Post('ask')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gửi câu hỏi tới Chatbot tư vấn da liễu và nhận phản hồi cùng gợi ý sản phẩm phù hợp (Hỗ trợ cả khách và thành viên)',
  })
  @ApiBody({ type: AskChatbotDto })
  @ApiResponse({
    status: 201,
    description: 'Trả về câu trả lời, mảng các sản phẩm đề xuất, và ID phiên chat hiện tại.',
  })
  async askChatbot(@Body() dto: AskChatbotDto, @Req() req: any) {
    const sessionId = dto.sessionId || 'default-session';
    this.validateSessionAccess(sessionId, req.user);

    const result = await this.chatbotService.ask(dto);
    
    return {
      success: true,
      message: 'Xử lý phản hồi từ chatbot tư vấn thành công',
      data: result,
    };
  }

  @Post('ask-stream')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gửi câu hỏi tới Chatbot và nhận phản hồi dưới dạng Stream (Hỗ trợ cả khách và thành viên)',
  })
  @ApiBody({ type: AskChatbotDto })
  async askChatbotStream(@Body() dto: AskChatbotDto, @Res() res: express.Response, @Req() req: any) {
    const sessionId = dto.sessionId || 'default-session';
    this.validateSessionAccess(sessionId, req.user);

    // Set headers for streaming response (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.chatbotService.askStream(dto, res);
  }

  @Get('history/:sessionId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy lịch sử trò chuyện của một phiên (sessionId) - Hỗ trợ cả khách và thành viên',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID của phiên chat cần lấy lịch sử',
    type: String,
    example: 'user-1-session-123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về danh sách các tin nhắn trong lịch sử chat.',
  })
  async getHistory(@Param('sessionId') sessionId: string, @Req() req: any) {
    this.validateSessionAccess(sessionId, req.user);

    const data = await this.chatbotService.getChatHistory(sessionId);
    return {
      success: true,
      message: 'Lấy lịch sử cuộc trò chuyện thành công',
      data,
    };
  }

  @Delete('history/:sessionId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa lịch sử trò chuyện của một phiên (sessionId) - Hỗ trợ cả khách và thành viên',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID của phiên chat cần xóa lịch sử',
    type: String,
    example: 'user-1-session-123456',
  })
  @ApiResponse({
    status: 200,
    description: 'Xóa thành công lịch sử cuộc trò chuyện.',
  })
  async deleteHistory(@Param('sessionId') sessionId: string, @Req() req: any) {
    this.validateSessionAccess(sessionId, req.user);

    await this.chatbotService.deleteChatHistory(sessionId);
    return {
      success: true,
      message: 'Xóa lịch sử cuộc trò chuyện thành công',
    };
  }
}
