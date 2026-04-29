import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateBadgeDto } from './create-badge.dto.js';

export class CreateMultipleBadgesDto {
  @ApiProperty({ type: [CreateBadgeDto], description: 'Danh sách huy hiệu cần tạo' })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateBadgeDto)
  badges: CreateBadgeDto[];
}
