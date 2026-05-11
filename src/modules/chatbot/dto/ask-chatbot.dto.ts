import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskChatbotDto {
  @ApiProperty({
    description: 'Câu hỏi hoặc tin nhắn của người dùng',
    example: 'Da mình bị mụn viêm và dầu nhiều thì nên dùng kem chống nắng nào dưới 500k?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'ID phiên trò chuyện để lưu lịch sử chat (nếu có)',
    required: false,
    example: 'session-123456',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
