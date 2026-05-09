import { Controller, Post, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ChatbotService } from '../services/chatbot.service.js';
import { AskChatbotDto } from '../dto/ask-chatbot.dto.js';
import * as express from 'express';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Gửi câu hỏi tới Chatbot tư vấn da liễu và nhận phản hồi cùng gợi ý sản phẩm phù hợp',
  })
  @ApiBody({ type: AskChatbotDto })
  @ApiResponse({
    status: 201,
    description: 'Trả về câu trả lời, mảng các sản phẩm đề xuất, và ID phiên chat hiện tại.',
  })
  async askChatbot(@Body() dto: AskChatbotDto) {
    const result = await this.chatbotService.ask(dto);
    
    return {
      success: true,
      message: 'Xử lý phản hồi từ chatbot tư vấn thành công',
      data: result,
    };
  }

  @Post('ask-stream')
  @ApiOperation({
    summary: 'Gửi câu hỏi tới Chatbot và nhận phản hồi dưới dạng Stream (Server-Sent Events)',
  })
  @ApiBody({ type: AskChatbotDto })
  async askChatbotStream(@Body() dto: AskChatbotDto, @Res() res: express.Response) {
    // Set headers for streaming response (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await this.chatbotService.askStream(dto, res);
  }
}
