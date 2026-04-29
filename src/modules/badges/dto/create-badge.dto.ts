import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBadgeDto {
  @ApiProperty({ example: 'Bestseller', description: 'Tên huy hiệu' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.png', description: 'URL icon huy hiệu' })
  @IsString()
  @IsOptional()
  icon_url?: string;
}
