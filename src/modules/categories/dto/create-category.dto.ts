import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sữa rửa mặt', description: 'Tên danh mục' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: true, description: 'Trạng thái hoạt động', required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
