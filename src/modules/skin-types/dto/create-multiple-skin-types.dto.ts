import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateSkinTypeDto } from './create-skin-type.dto.js';

export class CreateMultipleSkinTypesDto {
  @ApiProperty({ type: [CreateSkinTypeDto], description: 'Danh sách loại da cần tạo' })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateSkinTypeDto)
  skinTypes: CreateSkinTypeDto[];
}
