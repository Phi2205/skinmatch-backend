import { IsArray, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateIngredientDto } from './create-ingredient.dto.js';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMultipleIngredientsDto {
  @ApiProperty({ type: [CreateIngredientDto], description: 'Danh sách các thành phần cần thêm' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateIngredientDto)
  ingredients: CreateIngredientDto[];
}
