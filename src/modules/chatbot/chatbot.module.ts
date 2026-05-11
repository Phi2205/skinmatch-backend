import { Module } from '@nestjs/common';
import { ChatbotIngestionService } from './services/chatbot-ingestion.service.js';
import { ChatbotService } from './services/chatbot.service.js';
import { ChatbotAdminController } from './controllers/chatbot-admin.controller.js';
import { ChatbotController } from './controllers/chatbot.controller.js';
import { RedisModule } from '../../redis/redis.module.js';

@Module({
  imports: [RedisModule],
  controllers: [ChatbotAdminController, ChatbotController],
  providers: [ChatbotIngestionService, ChatbotService],
  exports: [ChatbotIngestionService, ChatbotService],
})
export class ChatbotModule {}
