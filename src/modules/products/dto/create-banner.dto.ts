import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBannerDto {
  @ApiPropertyOptional({ description: 'Tiêu đề banner' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả banner' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Văn bản trên nút bấm' })
  @IsString()
  @IsOptional()
  button_text?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn khi bấm nút' })
  @IsString()
  @IsOptional()
  button_link?: string;

  @ApiPropertyOptional({ description: 'Vị trí hiển thị' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động (mặc định: true)', default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === true || value === false) return value;
    return true; // Default is true for new banners unless specified otherwise
  })
  @IsBoolean()
  is_active?: boolean;
}
