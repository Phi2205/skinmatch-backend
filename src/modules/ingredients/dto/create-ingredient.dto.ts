import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIngredientDto {
  @ApiProperty({ example: 'Niacinamide', description: 'Tên thành phần' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
