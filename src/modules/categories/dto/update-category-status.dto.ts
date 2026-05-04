import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCategoryStatusDto {
  @ApiProperty({ example: true, description: 'Trạng thái hoạt động' })
  @IsBoolean()
  is_active: boolean;
}
