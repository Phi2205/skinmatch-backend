import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  productId: number;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiProperty({ default: 1, example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
