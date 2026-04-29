import { IsArray, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateConcernDto } from './create-concern.dto.js';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMultipleConcernsDto {
  @ApiProperty({ type: [CreateConcernDto], description: 'Danh sách các vấn đề da cần thêm' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateConcernDto)
  concerns: CreateConcernDto[];
}
