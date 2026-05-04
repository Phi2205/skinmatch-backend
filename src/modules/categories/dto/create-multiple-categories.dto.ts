import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto.js';

export class CreateMultipleCategoriesDto {
  @ApiProperty({ type: [CreateCategoryDto], description: 'Danh sách danh mục cần tạo' })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateCategoryDto)
  categories: CreateCategoryDto[];
}
