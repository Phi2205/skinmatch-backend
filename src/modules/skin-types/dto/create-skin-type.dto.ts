import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSkinTypeDto {
  @ApiProperty({ example: 'Da dầu', description: 'Tên loại da' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'Da thường xuyên đổ dầu...', description: 'Mô tả loại da', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
