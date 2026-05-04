import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdateProductImageDto {
  @ApiPropertyOptional({ description: 'URL của ảnh' })
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiPropertyOptional({ description: 'Text thay thế' })
  @IsString()
  @IsOptional()
  alt_text?: string;

  @ApiPropertyOptional({ description: 'Có phải ảnh chính không' })
  @IsBoolean()
  @IsOptional()
  is_main?: boolean;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị' })
  @IsNumber()
  @IsOptional()
  position?: number;
}
